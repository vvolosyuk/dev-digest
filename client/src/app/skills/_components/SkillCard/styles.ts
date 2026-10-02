import type { CSSProperties } from "react";

/** Co-located styles for SkillCard (mirrors AgentCard). */
export const s = {
  card: (active: boolean, enabled: boolean): CSSProperties => ({
    padding: 12,
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid " + (active ? "var(--border-strong)" : "var(--border)"),
    background: active ? "var(--bg-hover)" : "var(--bg-elevated)",
    opacity: enabled ? 1 : 0.55,
    marginBottom: 8,
    outlineOffset: 2,
  }),
  headerRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  iconBox: (color: string, bg: string): CSSProperties => ({
    width: 24,
    height: 24,
    borderRadius: 6,
    background: bg,
    color,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  }),
  name: {
    fontSize: 13,
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  description: {
    fontSize: 12.5,
    color: "var(--text-muted)",
    margin: "6px 0 8px",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  metaRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  source: { fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  agents: { fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" } satisfies CSSProperties,
} as const;
