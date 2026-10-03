import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView. */
export const s = {
  wrap: { maxWidth: 920, margin: "0 auto" } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  } satisfies CSSProperties,
  title: { margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: -0.3 } satisfies CSSProperties,
  repoName: { color: "var(--accent)" } satisfies CSSProperties,
  subtitle: { margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  scanResult: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  error: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--crit)",
    background: "var(--crit-bg)",
  } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
} as const;
