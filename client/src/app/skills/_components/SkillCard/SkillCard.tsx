/* SkillCard — one row in the Skills list: type icon, mono name, enabled
   toggle, one-line description, type badge, source label, agent count. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SKILL_TYPE_COLOR, SKILL_TYPE_ICON } from "../../constants";
import { needsVetting } from "../../helpers";
import { SkillTypeBadge } from "../SkillTypeBadge";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const TypeIcon = Icon[SKILL_TYPE_ICON[skill.type]];
  const { color, bg } = SKILL_TYPE_COLOR[skill.type];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={s.card(!!active, skill.enabled)}
    >
      <div style={s.headerRow}>
        <div style={s.iconBox(color, bg)}>
          <TypeIcon size={14} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          // Toggling must not select the card (same pattern as AgentCard).
          <div
            role="group"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={t("listItem.toggleLabel", { name: skill.name })}
          >
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
      </div>
      <div style={s.description} title={skill.description}>
        {skill.description}
      </div>
      <div style={s.metaRow}>
        <SkillTypeBadge type={skill.type} />
        <span style={s.source}>{t(`listItem.source.${skill.source}`)}</span>
        {needsVetting(skill) && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
            <span title={t("listItem.vettingTitle")}>{t("listItem.needsVetting")}</span>
          </Badge>
        )}
        {skill.agent_count != null && (
          <span style={s.agents}>{t("listItem.agentCount", { count: skill.agent_count })}</span>
        )}
      </div>
    </div>
  );
}
