import type { CSSProperties } from "react";

/** Co-located styles for VersionsTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  note: { fontSize: 14, color: "var(--text-muted)" } satisfies CSSProperties,
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 18px",
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  version: {
    fontSize: 13,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 6,
    color: "var(--accent-text)",
    background: "var(--accent-bg)",
    flexShrink: 0,
  } satisfies CSSProperties,
  text: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  noteText: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  actions: { display: "flex", gap: 6, flexShrink: 0 } satisfies CSSProperties,
} as const;
