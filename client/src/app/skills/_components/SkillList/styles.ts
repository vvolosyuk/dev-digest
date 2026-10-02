import type { CSSProperties } from "react";

/** Co-located styles for SkillList (mirrors AgentEditorShell's sidebar). */
export const s = {
  sidebar: {
    width: 320,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  head: { padding: "16px 16px 12px" } satisfies CSSProperties,
  headRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } satisfies CSSProperties,
  title: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  searchIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  list: {
    flex: 1,
    overflow: "auto",
    padding: "0 12px 12px",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,
  skeleton: { marginBottom: 8 } satisfies CSSProperties,
  note: { fontSize: 13, color: "var(--text-muted)", padding: "12px 4px" } satisfies CSSProperties,
} as const;
