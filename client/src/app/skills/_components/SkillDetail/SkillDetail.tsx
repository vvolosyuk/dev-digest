/* SkillDetail — right pane of /skills: header (type icon, name, type badge,
   vN, Run on evals [L06], Delete) + tabs. Config / Preview / Versions work;
   Context / Evals / Stats are stubs for later lessons. Without `skill` it
   shows the create form. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SKILL_TYPE_COLOR, SKILL_TYPE_ICON } from "../../constants";
import { SkillTypeBadge } from "../SkillTypeBadge";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersionsTab } from "./_components/VersionsTab";
import { StubTab } from "./_components/StubTab";
import { SKILL_TABS } from "./constants";
import { s } from "./styles";

export interface SkillDetailProps {
  /** Omit for create mode. */
  skill?: Skill;
  tab: string;
  onTab: (tab: string) => void;
  onDelete?: () => void;
  onSaved: (skill: Skill) => void;
  onCancelCreate: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function SkillDetail({
  skill,
  tab,
  onTab,
  onDelete,
  onSaved,
  onCancelCreate,
  onDirtyChange,
}: SkillDetailProps) {
  const t = useTranslations("skills");
  const type = skill?.type ?? "custom";
  const TypeIcon = Icon[SKILL_TYPE_ICON[type]];
  const activeTab = skill ? (SKILL_TABS.find((tb) => tb.key === tab) ?? SKILL_TABS[0]!) : SKILL_TABS[0]!;

  return (
    <div style={s.col}>
      <div style={s.header}>
        <div style={s.iconBox(SKILL_TYPE_COLOR[type].color, SKILL_TYPE_COLOR[type].bg)}>
          <TypeIcon size={16} />
        </div>
        <h1 className={skill ? "mono" : undefined} style={s.title}>
          {skill?.name ?? t("page.newSkill")}
        </h1>
        {skill && (
          <>
            <SkillTypeBadge type={skill.type} />
            <Badge icon="GitCommit" mono>
              v{skill.version}
            </Badge>
            {!skill.enabled && <Badge color="var(--text-muted)">{t("listItem.disabledBadge")}</Badge>}
            <div style={s.actions}>
              {/* Native title on a wrapper: disabled buttons don't show tooltips. */}
              <span title={t("page.runOnEvalsHint")}>
                <Button kind="secondary" size="sm" icon="Play" disabled>
                  {t("page.runOnEvals")}
                </Button>
              </span>
              <Button kind="danger" size="sm" icon="Trash" onClick={onDelete}>
                {t("page.delete")}
              </Button>
            </div>
          </>
        )}
      </div>

      {skill && (
        <div role="tablist" style={s.tabs}>
          {SKILL_TABS.map((tb) => {
            const I = Icon[tb.icon];
            const on = tb.key === activeTab.key;
            return (
              <button
                key={tb.key}
                role="tab"
                aria-selected={on}
                aria-disabled={tb.lesson ? true : undefined}
                title={tb.lesson ? t("stub.title", { lesson: tb.lesson }) : undefined}
                onClick={() => onTab(tb.key)}
                style={s.tab(on, !!tb.lesson)}
              >
                <I size={14} />
                {t(`tabs.${tb.key}`)}
                {tb.lesson && <span style={s.lesson}>{tb.lesson}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div style={s.body}>
        {!skill ? (
          <ConfigTab onSaved={onSaved} onCancel={onCancelCreate} onDirtyChange={onDirtyChange} />
        ) : activeTab.lesson ? (
          <StubTab title={t(`tabs.${activeTab.key}`)} lesson={activeTab.lesson} icon={activeTab.icon} />
        ) : activeTab.key === "preview" ? (
          <PreviewTab skill={skill} />
        ) : activeTab.key === "versions" ? (
          <VersionsTab skill={skill} />
        ) : (
          <ConfigTab key={skill.id} skill={skill} onSaved={onSaved} onDirtyChange={onDirtyChange} />
        )}
      </div>
    </div>
  );
}
