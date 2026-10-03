/* ConventionsView — the Conventions extractor page body: run/re-scan the
   extraction, review candidates (accept / reject / edit), then merge the
   accepted ones into a single skill via CreateConventionsSkillModal. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import {
  useConventions,
  useExtractConventions,
  useUpdateConvention,
  type ConventionStatus,
  type ExtractConventionsResult,
} from "@/lib/hooks/conventions";
import { ApiError } from "@/lib/api";
import { SKELETON_CARDS } from "../../constants";
import { shortRepoName, sortConventions } from "../../helpers";
import { ConventionCard } from "./_components/ConventionCard";
import { CreateConventionsSkillModal } from "./_components/CreateConventionsSkillModal";
import { s } from "./styles";

export function ConventionsView({ repoId, repoFullName }: { repoId: string; repoFullName: string }) {
  const t = useTranslations("conventions.page");
  const format = useFormatter();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [lastRun, setLastRun] = React.useState<ExtractConventionsResult | null>(null);
  const [creating, setCreating] = React.useState(false);

  const candidates = React.useMemo(() => sortConventions(data?.candidates ?? []), [data]);
  const decidable = candidates.filter((c) => c.status !== "rejected");
  const accepted = candidates.filter((c) => c.status === "accepted");
  const allAccepted = decidable.length > 0 && accepted.length === decidable.length;

  const runExtraction = () => extract.mutate(undefined, { onSuccess: setLastRun });
  const setStatus = (id: string, status: ConventionStatus) => update.mutate({ id, patch: { status } });
  const bulk = () => {
    const [from, to]: [ConventionStatus, ConventionStatus] = allAccepted
      ? ["accepted", "pending"]
      : ["pending", "accepted"];
    for (const c of decidable) if (c.status === from) setStatus(c.id, to);
  };

  const subtitle = data?.last_scan_at
    ? t("lastScan", { when: format.relativeTime(new Date(data.last_scan_at)) })
    : t("neverScanned");
  const extractError = extract.error
    ? extract.error instanceof ApiError
      ? extract.error.message
      : String(extract.error)
    : null;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            {t("headingPrefix")}
            <span className="mono" style={s.repoName}>
              {shortRepoName(repoFullName)}
            </span>
          </h1>
          <p style={s.subtitle}>
            {subtitle} · {t("subtitle")}
          </p>
        </div>
        {candidates.length > 0 && (
          <Button icon="RefreshCw" onClick={runExtraction} loading={extract.isPending}>
            {extract.isPending ? t("scanning") : t("rescan")}
          </Button>
        )}
      </div>

      {extractError && (
        <div role="alert" style={s.error}>
          {t("extractionFailed")}: {extractError}
        </div>
      )}
      {lastRun && !extract.isPending && (
        <div role="status" style={s.scanResult}>
          {t("scanResult", {
            files: lastRun.sampled_files,
            model: lastRun.model,
            kept: lastRun.candidates.filter((c) => c.status === "pending").length,
            discarded: lastRun.discarded,
            duplicates: lastRun.duplicates,
          })}
        </div>
      )}

      {isLoading ? (
        <div style={s.skeletons}>
          {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
            <Skeleton key={i} height={150} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title={t("loadError")}
          body={error instanceof ApiError ? error.message : undefined}
          onRetry={() => refetch()}
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon="ListChecks"
          title={t("empty.title")}
          body={t("empty.body")}
          cta={extract.isPending ? t("scanning") : t("empty.cta")}
          onCta={runExtraction}
          ctaLoading={extract.isPending}
        />
      ) : (
        <>
          <div style={s.toolbar}>
            <Button
              size="sm"
              icon={allAccepted ? "X" : "Check"}
              onClick={bulk}
              disabled={decidable.length === 0}
            >
              {allAccepted ? t("deselectAll") : t("acceptAll")}
            </Button>
            <span style={s.count}>
              {t("acceptedCount", { accepted: accepted.length, total: candidates.length })}
            </span>
            <div style={s.spacer} />
            <Button
              kind="primary"
              icon="Sparkles"
              disabled={accepted.length === 0}
              title={accepted.length === 0 ? t("createSkillHint") : undefined}
              onClick={() => setCreating(true)}
            >
              {t("createSkill")}
            </Button>
          </div>

          {candidates.map((c) => (
            <ConventionCard
              key={c.id}
              convention={c}
              onStatus={(status) => setStatus(c.id, status)}
              onEdit={(patch) => update.mutate({ id: c.id, patch })}
            />
          ))}
        </>
      )}

      {creating && (
        <CreateConventionsSkillModal
          repoId={repoId}
          repoFullName={repoFullName}
          accepted={accepted}
          onClose={() => setCreating(false)}
          onCreated={(skill) => {
            setCreating(false);
            router.push(`/skills/${skill.id}`);
          }}
        />
      )}
    </div>
  );
}
