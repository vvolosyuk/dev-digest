/* SaveVersionModal — confirm step of saving a skill edit: names the new
   version (stored as the version note) and shows what changed since the
   saved version. Nothing is persisted until "Save version" is clicked. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, TextInput } from "@devdigest/ui";
import { SkillDiff, type SkillSnapshot } from "../SkillDiff";
import { DIFF_MAX_HEIGHT, MODAL_WIDTH, VERSION_TITLE_MAX } from "./constants";
import { s } from "./styles";

export function SaveVersionModal({
  currentVersion,
  before,
  after,
  pending,
  onConfirm,
  onClose,
}: {
  currentVersion: number;
  before: SkillSnapshot;
  after: SkillSnapshot;
  pending?: boolean;
  /** Called with the trimmed title ("" when left blank). */
  onConfirm: (title: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("skills");
  const [title, setTitle] = React.useState("");
  const next = currentVersion + 1;
  const confirm = () => onConfirm(title.trim());

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("saveVersion.title", { from: currentVersion, to: next })}
      subtitle={t("saveVersion.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose} disabled={pending}>
            {t("saveVersion.cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={confirm} disabled={pending}>
            {t(pending ? "saveVersion.saving" : "saveVersion.confirm", { version: next })}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("saveVersion.versionTitle")} hint={t("saveVersion.versionTitleHint")}>
          <TextInput
            value={title}
            onChange={(v) => setTitle(v.slice(0, VERSION_TITLE_MAX))}
            placeholder={t("saveVersion.versionTitlePlaceholder")}
            aria-label={t("saveVersion.versionTitle")}
            autoFocus
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" && !pending) confirm();
            }}
          />
        </FormField>
        <SkillDiff before={before} after={after} maxHeight={DIFF_MAX_HEIGHT} />
      </div>
    </Modal>
  );
}
