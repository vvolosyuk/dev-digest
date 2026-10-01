import type { FindingRecord } from "@devdigest/shared";

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

/** Sort by severity (worst first), then by confidence (highest first) within
 *  the same severity — the priority order shown in the hover popover. */
export function sortFindingsForPopover<T extends { severity: string; confidence: number }>(
  findings: T[],
): T[] {
  return [...findings].sort((a, b) => {
    const bySeverity = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    return bySeverity !== 0 ? bySeverity : b.confidence - a.confidence;
  });
}

const RATIONALE_TRUNCATE_CHARS = 110;

/** First ~110 chars of a rationale + an ellipsis when longer; passthrough otherwise. */
export function truncateRationale(text: string, max = RATIONALE_TRUNCATE_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/** Format a finding's line range ("11" when single-line, else "11-15"). */
export function lineLabel(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
}
