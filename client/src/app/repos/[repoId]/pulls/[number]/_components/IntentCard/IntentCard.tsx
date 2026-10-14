"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Skeleton, type IconName } from "@devdigest/ui";
import { usePrIntent, useRecomputeIntent } from "@/lib/hooks";
import { ApiError } from "@/lib/api";
import type { IntentConfidence, PrIntentRecord } from "@/lib/types";
import { ScopeColumns } from "./_components/ScopeColumns/ScopeColumns";
import { IntentSources } from "./_components/IntentSources/IntentSources";
import { s } from "./styles";

interface IntentCardProps {
  prId: string | null | undefined;
}

const CONFIDENCE_STYLE: Record<IntentConfidence, { color: string; bg: string; icon: IconName }> = {
  high: { color: "var(--ok)", bg: "var(--ok-bg)", icon: "Check" },
  medium: { color: "var(--warn)", bg: "var(--warn-bg)", icon: "Info" },
  low: { color: "var(--text-muted)", bg: "var(--bg-hover)", icon: "AlertTriangle" },
};

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

/** The PR's derived intent: sentence, scope lists, risk areas, confidence, sources. */
export function IntentCard({ prId }: IntentCardProps) {
  const t = useTranslations("brief");
  const { data, isLoading, error } = usePrIntent(prId);
  const recompute = useRecomputeIntent(prId);

  if (isLoading) return <Skeleton height={160} />;

  const record = data?.intent ?? null;
  const stale = data?.stale ?? false;
  const mutationError = recompute.error ? errorMessage(recompute.error, t("intent.failed")) : null;

  return (
    <section style={s.card} aria-label={t("intent.title")}>
      <div style={s.header}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{t("intent.title")}</h3>
        {record && <ConfidenceBadge confidence={record.confidence ?? "low"} />}
        {record && stale && <Badge>{t("intent.stale")}</Badge>}
        <span style={s.spacer} />
        <Button
          size="sm"
          icon="RefreshCw"
          loading={recompute.isPending}
          disabled={recompute.isPending || !prId}
          onClick={() => recompute.mutate()}
        >
          {record ? t("intent.recompute") : t("intent.derive")}
        </Button>
      </div>

      {error && <p style={s.error}>{errorMessage(error, t("intent.failed"))}</p>}
      {mutationError && <p style={s.error}>{mutationError}</p>}

      {record ? (
        <IntentBody record={record} />
      ) : (
        !error && <p style={s.hint}>{t("intent.empty")}</p>
      )}
    </section>
  );
}

function ConfidenceBadge({ confidence }: { confidence: IntentConfidence }) {
  const t = useTranslations("brief");
  const c = CONFIDENCE_STYLE[confidence];
  return (
    <Badge icon={c.icon} color={c.color} bg={c.bg}>
      {t(`intent.confidence.${confidence}`)}
    </Badge>
  );
}

function IntentBody({ record }: { record: PrIntentRecord }) {
  const t = useTranslations("brief");
  const risks = record.risk_areas ?? [];
  const meta = [
    record.model,
    record.cost_usd != null ? `$${record.cost_usd.toFixed(4)}` : null,
    record.computed_at ? t("intent.computed", { time: new Date(record.computed_at).toLocaleString() }) : null,
  ].filter(Boolean);

  return (
    <>
      <blockquote style={s.quote}>{record.intent}</blockquote>

      {record.confidence === "low" && <p style={s.hint}>{t("intent.lowHint")}</p>}

      <ScopeColumns inScope={record.in_scope} outOfScope={record.out_of_scope} />

      {risks.length > 0 && (
        <div>
          <h4 style={s.colTitle}>{t("intent.riskAreas")}</h4>
          <div style={s.chips}>
            {risks.map((r, i) => (
              <Badge key={`${r.label}-${i}`} icon="AlertTriangle" color="var(--warn)" bg="var(--warn-bg)">
                {r.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div style={s.footer}>
        <IntentSources sources={record.sources ?? []} />
        {meta.length > 0 && <p style={s.hint}>{meta.join(" · ")}</p>}
      </div>
    </>
  );
}
