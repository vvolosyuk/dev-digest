/** Pure helpers for VersionsTab. */

/** Short, locale-aware timestamp for a version row; falls back to the raw value. */
export function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
