import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { PrMeta, PrFile, PrCommit } from '@devdigest/shared';
import type { PullRow } from '../../../db/rows.js';
export type { PullRow };

export type PrFileRow = typeof t.prFiles.$inferSelect;
export type PrCommitRow = typeof t.prCommits.$inferSelect;

export async function listByRepo(db: Db, repoId: string): Promise<PullRow[]> {
  return db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
}

export async function getInWorkspace(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<PullRow | undefined> {
  const [row] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
  return row;
}

/** Upsert one PR from a GitHub list-sync payload (idempotent on repo_id+number). */
export async function upsertFromGitHub(
  db: Db,
  workspaceId: string,
  repoId: string,
  pr: PrMeta,
): Promise<void> {
  await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      branch: pr.branch,
      base: pr.base,
      headSha: pr.head_sha,
      additions: pr.additions,
      deletions: pr.deletions,
      filesCount: pr.files_count,
      status: pr.status,
      openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
      updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
    })
    .onConflictDoUpdate({
      target: [t.pullRequests.repoId, t.pullRequests.number],
      set: {
        title: pr.title,
        headSha: pr.head_sha,
        status: pr.status,
        updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
      },
    });
}

/** Backfill diff-size stats from a per-PR GitHub detail fetch (list payload
 *  doesn't carry them). */
export async function updateDiffStats(
  db: Db,
  prId: string,
  stats: { additions: number; deletions: number; filesCount: number },
): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({
      additions: stats.additions,
      deletions: stats.deletions,
      filesCount: stats.filesCount,
    })
    .where(eq(t.pullRequests.id, prId));
}

/** Refresh a PR's detail-only fields (body + diff stats) from a live GitHub
 *  detail fetch. */
export async function updateDetailFields(
  db: Db,
  prId: string,
  patch: { body: string | null; additions: number; deletions: number; filesCount: number },
): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({
      body: patch.body,
      additions: patch.additions,
      deletions: patch.deletions,
      filesCount: patch.filesCount,
    })
    .where(eq(t.pullRequests.id, prId));
}

/** Replace a PR's files + commits with a fresh GitHub detail fetch, in one
 *  transaction — a crash mid-sequence must not leave rows deleted but not
 *  reinserted. */
export async function replaceFilesAndCommits(
  db: Db,
  prId: string,
  files: PrFile[],
  commits: PrCommit[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
    if (files.length > 0) {
      await tx.insert(t.prFiles).values(
        files.map((f) => ({
          prId,
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
      );
    }
    await tx.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
    if (commits.length > 0) {
      await tx.insert(t.prCommits).values(
        commits.map((c) => ({
          prId,
          sha: c.sha,
          message: c.message,
          author: c.author,
          committedAt: c.committed_at ? new Date(c.committed_at) : null,
        })),
      );
    }
  });
}

export async function listFiles(db: Db, prId: string): Promise<PrFileRow[]> {
  return db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
}

export async function listCommits(db: Db, prId: string): Promise<PrCommitRow[]> {
  return db.select().from(t.prCommits).where(eq(t.prCommits.prId, prId));
}
