import type { DiffKind } from "./helpers";

/** Constants for SkillDiff. */

/** Versioned metadata fields compared above the body diff. */
export const META_FIELDS = ["name", "description", "type"] as const;

/** Unified-diff style gutter marker per line kind. */
export const DIFF_PREFIX: Record<DiffKind, string> = { same: "  ", add: "+ ", del: "- " };
