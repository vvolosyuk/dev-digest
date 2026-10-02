import type { CSSProperties } from "react";

/** Co-located styles for DeleteSkillModal. */
export const s = {
  body: { padding: "18px 24px" } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
  text: { fontSize: 14, color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.5 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0 } satisfies CSSProperties,
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    padding: "6px 0",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  itemIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
