import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';

export type RepoRow = typeof t.repos.$inferSelect;

export async function getByIdInWorkspace(
  db: Db,
  workspaceId: string,
  repoId: string,
): Promise<RepoRow | undefined> {
  const [row] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
  return row;
}
