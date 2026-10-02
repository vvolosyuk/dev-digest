/* VersionsTab — version history (newest first) with Diff against the current
   skill and Restore (creates a new version; history is never rewritten). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { VersionDiffModal } from "../../../VersionDiffModal";
import { TabHeader } from "../TabHeader";
import { formatVersionDate } from "./helpers";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);

  const onRestore = (version: number) => {
    if (!window.confirm(t("versions.restoreConfirm", { version }))) return;
    restore.mutate(
      { id: skill.id, version },
      {
        onSuccess: (restored) =>
          toast.success(t("versions.restoredToast", { from: version, to: restored.version })),
      },
    );
  };

  if (isLoading) return <Skeleton height={160} />;
  if (isError) return <ErrorState title={t("versions.loadError")} onRetry={() => refetch()} />;
  if (!versions || versions.length === 0) return <div style={s.note}>{t("versions.empty")}</div>;

  return (
    <div style={s.wrap}>
      <TabHeader
        title={t("versions.title")}
        badge={<Badge>{t("versions.count", { count: versions.length })}</Badge>}
        hint={t("versions.hint")}
      />
      <ul style={s.list}>
        {versions.map((v) => {
          const current = v.version === skill.version;
          return (
            <li key={v.version} style={s.row}>
              <span className="mono tnum" style={s.version}>
                v{v.version}
              </span>
              <div style={s.text}>
                <span style={s.noteText} title={v.note ?? undefined}>
                  {v.note || t("versions.noNote")}
                </span>
                <span className="tnum" style={s.date}>
                  {formatVersionDate(v.created_at)}
                </span>
              </div>
              {current ? (
                <Badge color="var(--ok)" bg="var(--ok-bg)" dot>
                  {t("versions.current")}
                </Badge>
              ) : (
                <div style={s.actions}>
                  <Button
                    kind="ghost"
                    size="sm"
                    aria-label={`${t("versions.diff")} v${v.version}`}
                    onClick={() => setDiffVersion(v.version)}
                  >
                    {t("versions.diff")}
                  </Button>
                  <Button
                    kind="secondary"
                    size="sm"
                    icon="History"
                    aria-label={`${t("versions.restore")} v${v.version}`}
                    disabled={restore.isPending}
                    onClick={() => onRestore(v.version)}
                  >
                    {t("versions.restore")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {diffVersion != null && (
        <VersionDiffModal skill={skill} version={diffVersion} onClose={() => setDiffVersion(null)} />
      )}
    </div>
  );
}
