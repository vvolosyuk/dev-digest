import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';

/**
 * PR-list aggregates: per-PR score / cost / findings-by-severity, computed
 * on read from reviews/agent_runs/findings (no FK denorm on pull_requests).
 * Previously inlined in `pulls/routes.ts` with zero test coverage — see
 * `server/test/pulls-aggregates.it.test.ts`.
 */

/** Latest-review SCORE per PR. Rows are newest-first, so the first row seen
 *  per PR is its latest `kind='review'` score. */
export async function latestScoreByPr(
  db: Db,
  prIds: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (prIds.length === 0) return out;
  const rows = await db
    .select({ prId: t.reviews.prId, score: t.reviews.score })
    .from(t.reviews)
    .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
    .orderBy(desc(t.reviews.createdAt));
  for (const row of rows) {
    if (!out.has(row.prId)) out.set(row.prId, row.score);
  }
  return out;
}

/** Total COST per PR — summed across every agent_run ever made on the PR
 *  (all agents, all time), not just the latest review round. */
export async function totalCostByPr(
  db: Db,
  prIds: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (prIds.length === 0) return out;
  const rows = await db
    .select({ prId: t.agentRuns.prId, total: sql<string | null>`sum(${t.agentRuns.costUsd})` })
    .from(t.agentRuns)
    .where(inArray(t.agentRuns.prId, prIds))
    .groupBy(t.agentRuns.prId);
  for (const row of rows) {
    if (row.prId) out.set(row.prId, row.total != null ? Number(row.total) : null);
  }
  return out;
}

/** Per-PR findings rows (every non-dismissed finding across every review
 *  ever run on the PR), for `rollupSeverities()` to tally. Returns raw rows,
 *  not a tally — the caller owns the rollup logic. */
export async function findingsBySeverityByPr(
  db: Db,
  prIds: string[],
): Promise<Map<string, { severity: string }[]>> {
  const out = new Map<string, { severity: string }[]>();
  if (prIds.length === 0) return out;
  const rows = await db
    .select({ prId: t.reviews.prId, severity: t.findings.severity })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
    .where(
      and(
        inArray(t.reviews.prId, prIds),
        eq(t.reviews.kind, 'review'),
        isNull(t.findings.dismissedAt),
      ),
    );
  for (const row of rows) {
    const list = out.get(row.prId);
    if (list) list.push({ severity: row.severity });
    else out.set(row.prId, [{ severity: row.severity }]);
  }
  return out;
}
