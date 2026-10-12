import type { RepoRow } from './repository.js';

/**
 * F1 — workspace pure helpers. Pure functions only — no I/O, no DB, no
 * container.
 */

export interface RepoSummary {
  id: string;
  full_name: string;
  clone_path: string | null;
  last_polled_at: string | null;
  cloned: boolean;
}

/** Map a persisted repo row to the workspace overview's summary shape. */
export function toRepoSummaryDto(row: RepoRow): RepoSummary {
  return {
    id: row.id,
    full_name: row.fullName,
    clone_path: row.clonePath,
    last_polled_at: row.lastPolledAt?.toISOString() ?? null,
    cloned: Boolean(row.clonePath),
  };
}
