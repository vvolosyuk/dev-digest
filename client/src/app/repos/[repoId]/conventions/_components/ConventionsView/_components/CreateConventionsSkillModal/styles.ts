import type { CSSProperties } from "react";

/** Co-located styles for CreateConventionsSkillModal. */
export const s = {
  body: { maxHeight: "65vh", overflowY: "auto", paddingRight: 4 } satisfies CSSProperties,
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    marginBottom: 20,
    borderRadius: 8,
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "var(--accent-bg)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  note: { marginBottom: 16, fontSize: 12.5, color: "var(--text-muted)" } satisfies CSSProperties,
  warn: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--warn)",
    background: "var(--warn-bg)",
  } satisfies CSSProperties,
  bannerIcon: { color: "var(--accent)", flexShrink: 0 } satisfies CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } satisfies CSSProperties,
  enabledRow: { display: "flex", alignItems: "center", height: 38 } satisfies CSSProperties,
  error: { display: "block", color: "var(--crit)", marginTop: 4 } satisfies CSSProperties,
  footer: { display: "flex", alignItems: "center", gap: 10, width: "100%" } satisfies CSSProperties,
  footerNote: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  conflict: { display: "flex", alignItems: "center", gap: 10, width: "100%" } satisfies CSSProperties,
  conflictTitle: { fontSize: 13, fontWeight: 600, color: "var(--warn)" } satisfies CSSProperties,
  conflictBody: { marginTop: 2, fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
