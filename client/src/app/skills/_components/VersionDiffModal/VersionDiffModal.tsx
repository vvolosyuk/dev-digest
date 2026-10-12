/* VersionDiffModal — selected version vs the current skill: changed
   name/description/type rows plus a line diff of the body. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersion } from "../../../../lib/hooks/skills";
import { SkillDiff } from "../SkillDiff";
import { MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export function VersionDiffModal({
  skill,
  version,
  onClose,
}: {
  skill: Skill;
  version: number;
  onClose: () => void;
}) {
  const t = useTranslations("skills");
  const { data: old, isLoading, isError, refetch } = useSkillVersion(skill.id, version);

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("diff.title", { from: version, to: skill.version })}
      subtitle={t("diff.subtitle", { from: version })}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="secondary" onClick={onClose}>
            {t("diff.close")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {isLoading ? (
          <Skeleton height={160} />
        ) : isError || !old ? (
          <ErrorState title={t("diff.loadError")} onRetry={() => refetch()} />
        ) : (
          <SkillDiff before={old} after={skill} />
        )}
      </div>
    </Modal>
  );
}
