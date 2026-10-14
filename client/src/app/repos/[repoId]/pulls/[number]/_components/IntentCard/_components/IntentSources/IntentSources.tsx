"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { IntentSource } from "@/lib/types";
import { s } from "../../styles";

interface IntentSourcesProps {
  sources: IntentSource[];
}

/** What the intent was derived from. Refs are untrusted text — never linkified. */
export function IntentSources({ sources }: IntentSourcesProps) {
  const t = useTranslations("brief");
  if (sources.length === 0) return null;
  return (
    <div>
      <h4 style={s.colTitle}>{t("intent.sources")}</h4>
      <ul style={s.list}>
        {sources.map((src, i) => (
          <li key={`${src.kind}-${src.ref}-${i}`} style={s.item}>
            <span style={s.sourceKind}>{src.kind.replace("_", " ")}</span>
            <span style={s.sourceRef}>{src.ref}</span>
            {!src.fetched && <span style={s.hint}>({t("intent.notFetched")})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
