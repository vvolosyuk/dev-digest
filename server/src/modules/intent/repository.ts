import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PullRow } from '../../db/rows.js';
import type { Confidence, IntentRiskArea, IntentSource, PrIntentRecord } from './schemas.js';

/**
 * intent data-access — the ONLY reader/writer of `pr_intent`. PR, commit and
 * file rows are read here too (workspace-scoped through the PR) so the service
 * never reaches into another module's repository.
 */

export type RepoRow = typeof t.repos.$inferSelect;

export interface PullContext {
  pull: PullRow;
  repo: RepoRow;
  commits: { sha: string; message: string }[];
  files: { path: string; additions: number; deletions: number; patch: string | null }[];
}

export interface StoredIntent {
  record: PrIntentRecord;
  /** Hash of the inputs the record was computed from (cache key). */
  inputHash: string | null;
}

export interface IntentValues {
  intent: string;
  inScope: string[];
  outOfScope: string[];
  confidence: Confidence;
  sources: IntentSource[];
  riskAreas: IntentRiskArea[];
  provider: string;
  model: string;
  headSha: string;
  inputHash: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
}

export class IntentRepository {
  constructor(private db: Db) {}

  async getRecord(prId: string): Promise<StoredIntent | undefined> {
    const [row] = await this.db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
    if (!row) return undefined;
    return {
      inputHash: row.inputHash,
      record: {
        intent: row.intent,
        in_scope: row.inScope,
        out_of_scope: row.outOfScope,
        confidence: (row.confidence as Confidence | null) ?? null,
        sources: row.sources as IntentSource[],
        risk_areas: row.riskAreas as IntentRiskArea[],
        provider: row.provider,
        model: row.model,
        head_sha: row.headSha,
        tokens_in: row.tokensIn,
        tokens_out: row.tokensOut,
        cost_usd: row.costUsd,
        computed_at: row.computedAt?.toISOString() ?? null,
      },
    };
  }

  async upsertRecord(prId: string, v: IntentValues): Promise<void> {
    const set = {
      intent: v.intent,
      inScope: v.inScope,
      outOfScope: v.outOfScope,
      confidence: v.confidence,
      sources: v.sources,
      riskAreas: v.riskAreas,
      provider: v.provider,
      model: v.model,
      headSha: v.headSha,
      inputHash: v.inputHash,
      tokensIn: v.tokensIn,
      tokensOut: v.tokensOut,
      costUsd: v.costUsd,
      computedAt: new Date(),
    };
    await this.db
      .insert(t.prIntent)
      .values({ prId, ...set })
      .onConflictDoUpdate({ target: t.prIntent.prId, set });
  }

  /** PR + repo + persisted commits/files, scoped to the workspace. */
  async getPullContext(workspaceId: string, prId: string): Promise<PullContext | undefined> {
    const [pull] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    if (!pull) return undefined;
    const [repo] = await this.db.select().from(t.repos).where(eq(t.repos.id, pull.repoId));
    if (!repo) return undefined;
    return { pull, repo, ...(await this.getCommitsAndFiles(prId)) };
  }

  /** Persisted commits (oldest first) and changed files of a PR. */
  async getCommitsAndFiles(prId: string): Promise<Pick<PullContext, 'commits' | 'files'>> {
    const commits = await this.db
      .select({ sha: t.prCommits.sha, message: t.prCommits.message })
      .from(t.prCommits)
      .where(eq(t.prCommits.prId, prId))
      .orderBy(asc(t.prCommits.committedAt));
    const files = await this.db
      .select({
        path: t.prFiles.path,
        additions: t.prFiles.additions,
        deletions: t.prFiles.deletions,
        patch: t.prFiles.patch,
      })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, prId));
    return { commits, files };
  }
}
