import type { CSSProperties } from "react";

/** Co-located styles for TabHeader. */
export const s = {
  wrap: { marginBottom: 20 } satisfies CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 10, minHeight: 28 } satisfies CSSProperties,
  title: { fontSize: 18, fontWeight: 700, margin: 0 } satisfies CSSProperties,
  right: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" } satisfies CSSProperties,
} as const;
