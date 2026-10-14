"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { s } from "../../styles";

interface ScopeColumnsProps {
  inScope: string[];
  outOfScope: string[];
}

/** IN SCOPE / OUT OF SCOPE columns. Items are model output — plain text only. */
export function ScopeColumns({ inScope, outOfScope }: ScopeColumnsProps) {
  const t = useTranslations("brief");
  return (
    <div style={s.columns}>
      <ScopeList title={t("intent.inScope")} items={inScope} variant="in" empty={t("intent.none")} />
      <ScopeList title={t("intent.outOfScope")} items={outOfScope} variant="out" empty={t("intent.none")} />
    </div>
  );
}

function ScopeList({
  title,
  items,
  variant,
  empty,
}: {
  title: string;
  items: string[];
  variant: "in" | "out";
  empty: string;
}) {
  const Mark = variant === "in" ? Icon.Check : Icon.X;
  const color = variant === "in" ? "var(--ok)" : "var(--text-muted)";
  return (
    <div>
      <h4 style={s.colTitle}>{title}</h4>
      {items.length === 0 ? (
        <p style={s.hint}>{empty}</p>
      ) : (
        <ul style={s.list}>
          {items.map((item, i) => (
            <li key={`${item}-${i}`} style={s.item}>
              <Mark size={14} style={{ color, flexShrink: 0, marginTop: 3 }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
