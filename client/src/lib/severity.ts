/**
 * Canonical severity ordering, shared by every place that sorts or displays
 * findings by severity (PR findings panel, hover popover, severity badges).
 * Previously defined independently in three places — see the improvement
 * plan, Tier 1 item 1.
 */

/** Sort weight per severity (lower = shown first). */
export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
  INFO: 3,
};

/** Display order for the three finding severities tracked in rollups/badges
 *  (`INFO` findings aren't tallied in `FindingsBySeverity`, so it's excluded
 *  here). */
export const SEVERITY_DISPLAY_ORDER: readonly ("CRITICAL" | "WARNING" | "SUGGESTION")[] = [
  "CRITICAL",
  "WARNING",
  "SUGGESTION",
];
