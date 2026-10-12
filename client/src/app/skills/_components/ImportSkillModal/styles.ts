import type { CSSProperties } from "react";

/** Co-located styles for ImportSkillModal. */
export const s = {
  body: { padding: "18px 24px" } satisfies CSSProperties,
  footer: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  fileInput: {
    display: "block",
    width: "100%",
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px dashed var(--border-strong)",
    background: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    fontSize: 13,
  } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)", marginTop: 8 } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginTop: 8 } satisfies CSSProperties,
} as const;
