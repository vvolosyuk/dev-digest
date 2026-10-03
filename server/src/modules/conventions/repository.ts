import { and, desc, eq, inArray, max, ne } from 'drizzle-orm';
import { FeatureModelChoice } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionRow } from '../../db/rows.js';
import { FEATURE_MODELS_SETTINGS_KEY } from './constants.js';
import { normalizeRule, type ConventionStatus, type VerifiedCandidate } from './helpers.js';
export type { ConventionRow };

/** The few repo columns the extractor needs. */
export interface ConventionRepoBasics {
  id: string;
  owner: string;
  name: string;
  clonePath: string | null;
}

export interface ConventionPatch {
  status?: ConventionStatus;
  rule?: string;
  category?: string;
}

/**
 * L02 — conventions data-access. Owns the `conventions` table; reads `repos`
 * and the workspace `settings` row it needs (no other module's repository).
 * Workspace-scoped throughout.
 */
export class ConventionsRepository {
  constructor(private db: Db) {}

  async getRepo(workspaceId: string, repoId: string): Promise<ConventionRepoBasics | undefined> {
    const [row] = await this.db
      .select({
        id: t.repos.id,
        owner: t.repos.owner,
        name: t.repos.name,
        clonePath: t.repos.clonePath,
      })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  /** The workspace's `conventions` feature-model override, if any (valid). */
  async featureModelOverride(workspaceId: string): Promise<FeatureModelChoice | undefined> {
    const rows = await this.db
      .select({ value: t.settings.value })
      .from(t.settings)
      .where(
        and(eq(t.settings.workspaceId, workspaceId), eq(t.settings.key, FEATURE_MODELS_SETTINGS_KEY)),
      );
    for (const r of rows) {
      const fm = r.value as Record<string, unknown> | null;
      const parsed = FeatureModelChoice.safeParse(fm?.conventions);
      if (parsed.success) return parsed.data;
    }
    return undefined;
  }

  /** Candidates for a repo, highest confidence first. */
  async listByRepo(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      .orderBy(desc(t.conventions.confidence), desc(t.conventions.createdAt));
  }

  async lastScanAt(workspaceId: string, repoId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ at: max(t.conventions.createdAt) })
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
    return row?.at ?? null;
  }

  async listByIds(workspaceId: string, repoId: string, ids: string[]): Promise<ConventionRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          inArray(t.conventions.id, ids),
        ),
      );
  }

  /**
   * Re-scan write, atomically: drop the repo's undecided (`pending`) candidates,
   * skip new ones whose rule duplicates an accepted/rejected decision, insert
   * the rest. Returns how many were skipped as duplicates.
   */
  async replacePending(
    workspaceId: string,
    repoId: string,
    candidates: VerifiedCandidate[],
  ): Promise<{ inserted: number; duplicates: number }> {
    return this.db.transaction(async (tx) => {
      const scope = and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId));
      await tx.delete(t.conventions).where(and(scope, eq(t.conventions.status, 'pending')));
      const decided = await tx
        .select({ rule: t.conventions.rule })
        .from(t.conventions)
        .where(and(scope, ne(t.conventions.status, 'pending')));
      const known = new Set(decided.map((d) => normalizeRule(d.rule)));
      const fresh = candidates.filter((c) => !known.has(normalizeRule(c.rule)));
      if (fresh.length > 0) {
        await tx.insert(t.conventions).values(
          fresh.map((c) => ({
            workspaceId,
            repoId,
            category: c.category,
            rule: c.rule,
            evidencePath: c.evidencePath,
            evidenceLineStart: c.evidenceLineStart,
            evidenceLineEnd: c.evidenceLineEnd,
            evidenceSnippet: c.evidenceSnippet,
            confidence: c.confidence,
            status: 'pending' as const,
            accepted: false,
          })),
        );
      }
      return { inserted: fresh.length, duplicates: candidates.length - fresh.length };
    });
  }

  async update(
    workspaceId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.status !== undefined
          ? { status: patch.status, accepted: patch.status === 'accepted' }
          : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }
}
