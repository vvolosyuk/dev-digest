/* DeleteSkillModal — confirm deleting a skill, listing the agents that link
   it (they are unlinked by the server's cascade). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill, useSkillAgents } from "../../../../lib/hooks/skills";
import { useToast } from "../../../../lib/toast";
import { MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export function DeleteSkillModal({
  skill,
  onClose,
  onDeleted,
}: {
  skill: Skill;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: agents, isLoading } = useSkillAgents(skill.id);
  const del = useDeleteSkill();

  const confirm = () =>
    del.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("delete.deletedToast", { name: skill.name }));
        onDeleted();
      },
    });

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("delete.title")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose} disabled={del.isPending}>
            {t("delete.cancel")}
          </Button>
          <Button kind="danger" icon="Trash" onClick={confirm} loading={del.isPending}>
            {del.isPending ? t("delete.deleting") : t("delete.confirm")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <p style={s.text}>{t("delete.body", { name: skill.name })}</p>
        {isLoading ? (
          <p style={s.muted}>{t("delete.loadingAgents")}</p>
        ) : agents && agents.length > 0 ? (
          <>
            <p style={s.text}>{t("delete.usedBy", { count: agents.length })}</p>
            <ul style={s.list}>
              {agents.map((a) => (
                <li key={a.id} style={s.item}>
                  <Icon.Cpu size={13} style={s.itemIcon} />
                  {a.name}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={s.muted}>{t("delete.unused")}</p>
        )}
      </div>
    </Modal>
  );
}
