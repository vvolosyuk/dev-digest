import type { CSSProperties } from "react";

/** Co-located styles for SkillRow. */
export const s = {
  row: (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    background: active ? "var(--bg-elevated)" : "transparent",
  }),
  handle: (enabled: boolean): CSSProperties => ({
    display: "inline-flex",
    color: "var(--text-muted)",
    cursor: enabled ? "grab" : "default",
    opacity: enabled ? 1 : 0.3,
  }),
  fieldset: { border: 0, padding: 0, margin: 0, minWidth: 0, flex: 1 } satisfies CSSProperties,
  name: { fontSize: 13, color: "var(--text-primary)" } satisfies CSSProperties,
  moveBtns: { display: "inline-flex", gap: 4, minWidth: 54, justifyContent: "flex-end" } satisfies CSSProperties,
  moveBtn: (enabled: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-muted)",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.4,
  }),
} as const;
