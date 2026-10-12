import type { CSSProperties } from "react";

/** Shared line metrics: the gutter and textarea must match exactly. */
const FONT_SIZE = 13;
const LINE_HEIGHT = 1.6;
const PAD_Y = 10;

/** Co-located styles for SkillBodyEditor. */
export const s = {
  wrap: (invalid: boolean): CSSProperties => ({
    border: "1px solid " + (invalid ? "var(--crit)" : "var(--border-strong)"),
    borderRadius: 7,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  headerIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  fileName: { fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", cursor: "help" } satisfies CSSProperties,
  body: { display: "flex", alignItems: "stretch" } satisfies CSSProperties,
  gutter: {
    flexShrink: 0,
    minWidth: 44,
    padding: `${PAD_Y}px 8px`,
    textAlign: "right",
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    overflow: "hidden",
    userSelect: "none",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: "vertical",
    padding: `${PAD_Y}px 12px`,
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    outline: "none",
    whiteSpace: "pre",
    overflowX: "auto",
  } satisfies CSSProperties,
} as const;
