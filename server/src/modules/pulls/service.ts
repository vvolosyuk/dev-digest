import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { PrMeta, PrDetail, GitHubClient, PrReviewComment, PrCommentInput } from '@devdigest/shared';
import { PullsRepository } from './repository.js';
import { deriveReviewStatus, rollupSeverities } from './status.js';
import { BACKFILL_LIMIT } from './constants.js';

/** Minimal structured logger (pino-compatible: (obj, msg)) — passed in from
 *  the route's `req.log` rather than read off the container, same pattern as
 *  `ReviewService.runReview`. */
export type Logger = { warn: (obj: unknown, msg?: string) => void };

/** `PrMeta` plus the list's per-severity Findings breakdown (not part of the
 *  vendored `PrMeta` contract — this route has no Fastify response schema,
 *  so the handler's return type is just a TS annotation). */
export type PrMetaWithFindings = PrMeta & {
  findings_by_severity: Record<'CRITICAL' | 'WARNING' | 'SUGGESTION', number>;
};

/**
 * F1 — pulls service. PR import via Octokit (list + per-PR detail) and the
 * PR-list score/cost/findings aggregation. No HTTP and no raw SQL live here —
 * persistence goes through PullsRepository, pure derivation through
 * status.ts.
 *
 * Import is idempotent (unique repo_id+number). Review trigger is MANUAL and
 * owned by A2 — this module only imports/reads.
 */
export class PullsService {
  private repo: PullsRepository;

  constructor(private container: Container) {
    this.repo = new PullsRepository(container.db);
  }

  async listForRepo(
    workspaceId: string,
    repoId: string,
    logger: Logger,
  ): Promise<PrMetaWithFindings[]> {
    const { container } = this;
    const repo = await this.repo.getRepoInWorkspace(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    let gh: GitHubClient | null = null;
    try {
      gh = await container.github();
    } catch (err) {
      logger.warn({ err }, 'GitHub client unavailable (no token / offline); serving persisted PRs');
    }

    // Local-first: sync from GitHub when a token is configured, but never
    // fail the read — already-imported/seeded PRs stay viewable offline.
    if (gh) {
      try {
        const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
        for (const pr of pulls) {
          await this.repo.upsertFromGitHub(workspaceId, repo.id, pr);
        }
      } catch (err) {
        logger.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await this.repo.listByRepo(repo.id);

    if (gh) {
      const needStats = rows
        .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
        .slice(0, BACKFILL_LIMIT);
      for (const r of needStats) {
        try {
          const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, r.number);
          await this.repo.updateDiffStats(r.id, {
            additions: detail.additions,
            deletions: detail.deletions,
            filesCount: detail.files_count,
          });
          r.additions = detail.additions;
          r.deletions = detail.deletions;
          r.filesCount = detail.files_count;
        } catch (err) {
          logger.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
        }
      }
    }

    const prIds = rows.map((r) => r.id);
    const [latestReviewByPr, costByPr, findingRowsByPr] = await Promise.all([
      this.repo.latestScoreByPr(prIds),
      this.repo.totalCostByPr(prIds),
      this.repo.findingsBySeverityByPr(prIds),
    ]);

    const now = Date.now();
    return rows.map((r) => {
      const prFindingRows = findingRowsByPr.get(r.id);
      const rollup = rollupSeverities(prFindingRows ?? []);
      return {
        id: r.id,
        number: r.number,
        title: r.title,
        author: r.author,
        branch: r.branch,
        base: r.base,
        head_sha: r.headSha,
        additions: r.additions,
        deletions: r.deletions,
        files_count: r.filesCount,
        status: deriveReviewStatus({
          ghStatus: r.status,
          lastReviewedSha: r.lastReviewedSha,
          headSha: r.headSha,
          updatedAt: r.updatedAt,
          now,
        }),
        opened_at: r.openedAt?.toISOString() ?? null,
        updated_at: r.updatedAt?.toISOString() ?? null,
        score: latestReviewByPr.get(r.id) ?? null,
        cost_usd: costByPr.get(r.id) ?? null,
        findings_by_severity: {
          CRITICAL: rollup.critical,
          WARNING: rollup.warning,
          SUGGESTION: rollup.suggestion,
        },
      };
    });
  }

  async getDetail(workspaceId: string, prId: string, logger: Logger): Promise<PrDetail> {
    const { container } = this;
    const pr = await this.repo.getInWorkspace(workspaceId, prId);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.repo.getRepoInWorkspace(workspaceId, pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    // Local-first: refresh detail from GitHub when a token is configured;
    // otherwise serve the persisted files/commits/body (seeded or previously
    // imported) so PR detail works offline.
    try {
      const gh = await container.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);

      await this.repo.replaceFilesAndCommits(pr.id, detail.files, detail.commits);
      await this.repo.updateDetailFields(pr.id, {
        body: detail.body ?? null,
        additions: detail.additions,
        deletions: detail.deletions,
        filesCount: detail.files_count,
      });

      return { ...detail, id: pr.id };
    } catch (err) {
      logger.warn({ err }, 'GitHub PR detail refresh skipped (no token / offline); serving persisted detail');
      const files = await this.repo.listFiles(pr.id);
      const commits = await this.repo.listCommits(pr.id);
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        branch: pr.branch,
        base: pr.base,
        head_sha: pr.headSha,
        additions: pr.additions,
        deletions: pr.deletions,
        files_count: pr.filesCount,
        status: pr.status as PrDetail['status'],
        opened_at: pr.openedAt?.toISOString() ?? null,
        updated_at: pr.updatedAt?.toISOString() ?? null,
        body: pr.body ?? null,
        files: files.map((f) => ({
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
        commits: commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          committed_at: c.committedAt?.toISOString() ?? null,
        })),
      };
    }
  }

  private async resolvePrAndRepo(workspaceId: string, prId: string) {
    const pr = await this.repo.getInWorkspace(workspaceId, prId);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.repo.getRepoInWorkspace(workspaceId, pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return { pr, repo };
  }

  async getCommentsForPull(
    workspaceId: string,
    prId: string,
    logger: Logger,
  ): Promise<PrReviewComment[]> {
    const { pr, repo } = await this.resolvePrAndRepo(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch (err) {
      logger.warn({ err }, 'GitHub client unavailable; serving no PR comments');
      return [];
    }
    try {
      return await gh.listReviewComments({ owner: repo.owner, name: repo.name }, pr.number);
    } catch (err) {
      logger.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  async postComment(
    workspaceId: string,
    prId: string,
    input: PrCommentInput,
  ): Promise<PrReviewComment> {
    const { pr, repo } = await this.resolvePrAndRepo(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment({ owner: repo.owner, name: repo.name }, pr.number, {
        commitId: pr.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }
}
