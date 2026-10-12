import type { Db } from '../../db/client.js';
import type { PrMeta, PrFile, PrCommit } from '@devdigest/shared';

/**
 * F1 — pulls data-access layer. The ONLY layer touching the DB for the PR
 * import/list/detail domain (repo lookup, pull_requests, pr_files,
 * pr_commits, and the PR-list score/cost/findings aggregates).
 *
 * The query implementations are colocated, split by aggregate, under
 * `./repository/` (repo lookup, pull/files/commits, list aggregates). This
 * class composes them so its public API stays identical.
 */

import type { RepoRow } from './repository/repo.repo.js';
import type { PullRow, PrFileRow, PrCommitRow } from './repository/pull.repo.js';
export type { RepoRow, PullRow, PrFileRow, PrCommitRow };

import * as repoRepo from './repository/repo.repo.js';
import * as pullRepo from './repository/pull.repo.js';
import * as aggregatesRepo from './repository/aggregates.repo.js';

export class PullsRepository {
  constructor(private db: Db) {}

  // ---- repo lookup ----------------------------------------------------------

  getRepoInWorkspace(workspaceId: string, repoId: string): Promise<RepoRow | undefined> {
    return repoRepo.getByIdInWorkspace(this.db, workspaceId, repoId);
  }

  // ---- pull lookup / import ---------------------------------------------

  listByRepo(repoId: string): Promise<PullRow[]> {
    return pullRepo.listByRepo(this.db, repoId);
  }

  getInWorkspace(workspaceId: string, prId: string): Promise<PullRow | undefined> {
    return pullRepo.getInWorkspace(this.db, workspaceId, prId);
  }

  upsertFromGitHub(workspaceId: string, repoId: string, pr: PrMeta): Promise<void> {
    return pullRepo.upsertFromGitHub(this.db, workspaceId, repoId, pr);
  }

  updateDiffStats(
    prId: string,
    stats: { additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    return pullRepo.updateDiffStats(this.db, prId, stats);
  }

  updateDetailFields(
    prId: string,
    patch: { body: string | null; additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    return pullRepo.updateDetailFields(this.db, prId, patch);
  }

  replaceFilesAndCommits(prId: string, files: PrFile[], commits: PrCommit[]): Promise<void> {
    return pullRepo.replaceFilesAndCommits(this.db, prId, files, commits);
  }

  listFiles(prId: string): Promise<PrFileRow[]> {
    return pullRepo.listFiles(this.db, prId);
  }

  listCommits(prId: string): Promise<PrCommitRow[]> {
    return pullRepo.listCommits(this.db, prId);
  }

  // ---- PR-list aggregates ------------------------------------------------

  latestScoreByPr(prIds: string[]): Promise<Map<string, number | null>> {
    return aggregatesRepo.latestScoreByPr(this.db, prIds);
  }

  totalCostByPr(prIds: string[]): Promise<Map<string, number | null>> {
    return aggregatesRepo.totalCostByPr(this.db, prIds);
  }

  findingsBySeverityByPr(prIds: string[]): Promise<Map<string, { severity: string }[]>> {
    return aggregatesRepo.findingsBySeverityByPr(this.db, prIds);
  }
}
