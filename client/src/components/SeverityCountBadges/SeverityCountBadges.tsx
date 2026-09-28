/* SeverityCountBadges — compact per-severity finding counters (icon + count),
   shared by the Pull Requests list's Findings column and the PR detail page's
   Agent-runs Timeline. Presentational only: no data fetching, no hover state. */
"use client";

import React from "react";
import { SeverityBadge } from "@devdigest/ui";
import type { FindingsBySeverity } from "@/lib/types";

const ORDER: (keyof FindingsBySeverity)[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export function SeverityCountBadges({ counts }: { counts: FindingsBySeverity }) {
  const total = counts.CRITICAL + counts.WARNING + counts.SUGGESTION;
  if (total === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {ORDER.filter((sev) => counts[sev] > 0).map((sev) => (
        <SeverityBadge key={sev} severity={sev} count={counts[sev]} compact />
      ))}
    </div>
  );
}
