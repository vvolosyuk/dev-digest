import type { CSSProperties } from "react";

/** Co-located styles for ImportPreview. */
export const s = {
  banner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-primary)",
    fontSize: 13.5,
    lineHeight: 1.5,
    marginBottom: 20,
  } satisfies CSSProperties,
  bannerIcon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  error: { display: "block", color: "var(--crit)", marginTop: 4 } satisfies CSSProperties,
  bodyBox: {
    border: "1px solid var(--border)",
    borderRadius: 7,
    background: "var(--bg-surface)",
    padding: "12px 16px",
    maxHeight: 280,
    overflow: "auto",
    fontSize: 13.5,
  } satisfies CSSProperties,
  section: { marginBottom: 16 } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 6,
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0 } satisfies CSSProperties,
  item: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" } satisfies CSSProperties,
  itemIcon: { color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  warnIcon: { color: "var(--warn)", flexShrink: 0 } satisfies CSSProperties,
  path: { color: "var(--text-primary)" } satisfies CSSProperties,
  reason: { color: "var(--text-muted)", marginLeft: "auto" } satisfies CSSProperties,
} as const;
