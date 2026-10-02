"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_COLOR } from "../../constants";

/** Coloured type badge (rubric=accent, convention=green, security=red, custom=muted). */
export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  const { color, bg } = SKILL_TYPE_COLOR[type];
  return (
    <Badge color={color} bg={bg}>
      {t(`listItem.type.${type}`)}
    </Badge>
  );
}
