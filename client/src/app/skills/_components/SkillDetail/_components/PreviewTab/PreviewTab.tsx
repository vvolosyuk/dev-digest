/* PreviewTab — the skill exactly as the reviewing agent receives it: the
   saved skill run through the client mirror of the server's formatSkillBlock. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { formatSkillBlock } from "../../../../helpers";
import { TabHeader } from "../TabHeader";
import { s } from "./styles";

export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <TabHeader title={t("previewTab.title")} hint={t("previewTab.hint")} />
      <div style={s.card} data-testid="skill-preview">
        <Markdown>{formatSkillBlock(skill)}</Markdown>
      </div>
    </div>
  );
}
