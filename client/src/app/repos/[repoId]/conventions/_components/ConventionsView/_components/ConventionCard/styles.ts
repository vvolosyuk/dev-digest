import type { CSSProperties } from "react";

/** Co-located styles for ConventionCard. */
export const s = {
  card: (status: string): CSSProperties => ({
    display: "flex",
    gap: 16,
    padding: "18px 20px",
    marginBottom: 14,
    borderRadius: 10,
    border: "1px solid var(--border)",
    borderLeft: `3px solid ${
      status === "accepted" ? "var(--ok)" : status === "rejected" ? "var(--border-strong)" : "var(--accent)"
    }`,
    background: "var(--bg-surface)",
    opacity: status === "rejected" ? 0.55 : 1,
    transition: "opacity .15s",
  }),
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } satisfies CSSProperties,
  rule: {
    flex: 1,
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    fontStyle: "italic",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  evidence: {
    border: "1px solid var(--border)",
    borderRadius: 7,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  evidenceHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 6px 6px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.6,
    overflowX: "auto",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  lineNo: {
    display: "inline-block",
    minWidth: 32,
    marginRight: 12,
    textAlign: "right",
    color: "var(--text-muted)",
    userSelect: "none",
  } satisfies CSSProperties,
  confidenceRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  bar: { width: 90 } satisfies CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 8, width: 160, flexShrink: 0 } satisfies CSSProperties,
  editGrid: { display: "grid", gridTemplateColumns: "1fr 180px", gap: 10, marginBottom: 10 } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8, marginBottom: 12 } satisfies CSSProperties,
  error: { color: "var(--crit)", fontSize: 12, marginBottom: 8 } satisfies CSSProperties,
} as const;
