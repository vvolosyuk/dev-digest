import type { Convention, ConventionStatus } from "@/lib/hooks/conventions";
import { CONFIDENCE_HIGH, CONFIDENCE_MID, SKILL_NAME_MAX, SKILL_NAME_SUFFIX } from "./constants";

/** Pure helpers for the Conventions route. */

/** Lowercase kebab-case, `[a-z0-9-]` only, no leading/trailing dashes. */
export function toKebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `acme/payments-api` → `payments-api`. */
export function shortRepoName(fullName: string): string {
  return fullName.split("/").pop() || fullName;
}

/** Default skill name for a repo: `payments-api-conventions` (≤63 chars, valid skill name). */
export function defaultSkillName(fullName: string): string {
  const base = toKebab(shortRepoName(fullName)) || "repo";
  return `${base.slice(0, SKILL_NAME_MAX - SKILL_NAME_SUFFIX.length).replace(/-+$/, "")}${SKILL_NAME_SUFFIX}`;
}

/** Bar colour for a 0..1 confidence. */
export function confidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_HIGH) return "var(--ok)";
  if (confidence >= CONFIDENCE_MID) return "var(--warn)";
  return "var(--crit)";
}

/** `src/a.ts:23-31`, or `src/a.ts:23` for a single line. */
export function evidenceRef(c: Pick<Convention, "evidence_path" | "evidence_line_start" | "evidence_line_end">): string {
  const { evidence_path: p, evidence_line_start: a, evidence_line_end: b } = c;
  return a === b ? `${p}:${a}` : `${p}:${a}-${b}`;
}

const STATUS_ORDER: Record<ConventionStatus, number> = { accepted: 0, pending: 0, rejected: 1 };

/** Rejected candidates sink to the bottom; otherwise highest confidence first. */
export function sortConventions(list: readonly Convention[]): Convention[] {
  return [...list].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.confidence - a.confidence,
  );
}

/**
 * Keep the body's `# heading` in sync with the skill name: if the body still
 * starts with `# <prevName>`, rename it; a hand-edited heading is left alone.
 */
export function renameBodyHeading(body: string, prevName: string, nextName: string): string {
  const prev = `# ${prevName.trim()}`;
  const firstLine = body.split("\n", 1)[0] ?? "";
  if (firstLine !== prev) return body;
  return `# ${nextName.trim()}${body.slice(firstLine.length)}`;
}
