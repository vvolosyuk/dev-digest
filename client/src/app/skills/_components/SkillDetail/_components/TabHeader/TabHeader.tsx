/* TabHeader — the shared heading row of every skill detail tab: title, an
   optional badge (version / count), an optional muted hint line below, and an
   optional right-aligned slot (e.g. the Enabled toggle). */
"use client";

import React from "react";
import { s } from "./styles";

export function TabHeader({
  title,
  badge,
  hint,
  right,
}: {
  title: string;
  badge?: React.ReactNode;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div style={s.wrap}>
      <div style={s.row}>
        <h2 style={s.title}>{title}</h2>
        {badge}
        {right && <div style={s.right}>{right}</div>}
      </div>
      {hint && <p style={s.hint}>{hint}</p>}
    </div>
  );
}
