import type { CSSProperties } from "react";

/** Co-located styles for ConfigTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  enabledLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  error: { display: "block", color: "var(--crit)", marginTop: 4 } satisfies CSSProperties,
  actions: { display: "flex", gap: 10, marginTop: 4 } satisfies CSSProperties,
} as const;
