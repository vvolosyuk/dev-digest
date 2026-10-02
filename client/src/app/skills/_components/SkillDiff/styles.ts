import type { CSSProperties } from "react";
import type { DiffKind } from "./helpers";

const LINE_BG: Record<DiffKind, string> = {
  same: "transparent",
  add: "var(--ok-bg)",
  del: "var(--crit-bg)",
};
const LINE_COLOR: Record<DiffKind, string> = {
  same: "var(--text-secondary)",
  add: "var(--ok)",
  del: "var(--crit)",
};

/** Co-located styles for SkillDiff. */
export const s = {
  note: { fontSize: 14, color: "var(--text-muted)" } satisfies CSSProperties,
  metaRow: { marginBottom: 14 } satisfies CSSProperties,
  metaLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 6,
  } satisfies CSSProperties,
  diffBox: {
    border: "1px solid var(--border)",
    borderRadius: 7,
    overflow: "auto",
    maxHeight: "55vh",
    padding: "6px 0",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  line: (kind: DiffKind): CSSProperties => ({
    fontSize: 12.5,
    lineHeight: 1.6,
    padding: "0 12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: LINE_BG[kind],
    color: LINE_COLOR[kind],
  }),
} as const;
