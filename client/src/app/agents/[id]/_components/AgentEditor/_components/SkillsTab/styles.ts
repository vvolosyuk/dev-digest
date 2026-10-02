import type { CSSProperties } from "react";

/** Co-located styles for SkillsTab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", margin: "10px 0 14px", lineHeight: 1.5 } satisfies CSSProperties,
  list: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  note: { fontSize: 13, color: "var(--text-muted)", padding: "14px 16px" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
  loading: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  emptyLink: { color: "var(--accent)", fontWeight: 600 } satisfies CSSProperties,
} as const;
