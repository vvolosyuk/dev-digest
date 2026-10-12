/* SkillList — left column of /skills: heading, "Add Skill ▾" menu, search,
   and the SkillCard list (loading / error / no-match states). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, Skeleton, TextInput, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillCard } from "../SkillCard";
import { s } from "./styles";

export interface SkillListProps {
  skills: Skill[] | undefined;
  isLoading: boolean;
  isError: boolean;
  activeId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onCreate: () => void;
  onImport: () => void;
}

export function SkillList({
  skills,
  isLoading,
  isError,
  activeId,
  query,
  onQuery,
  onSelect,
  onToggle,
  onCreate,
  onImport,
}: SkillListProps) {
  const t = useTranslations("skills");
  return (
    <div style={s.sidebar}>
      <div style={s.head}>
        <div style={s.headRow}>
          <h1 style={s.title}>{t("page.heading")}</h1>
          <Dropdown
            width={210}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.menu.create"), icon: "Edit", onClick: onCreate },
              { label: t("page.menu.fromFile"), icon: "Upload", onClick: onImport },
            ]}
          />
        </div>
        <TextInput
          value={query}
          onChange={onQuery}
          placeholder={t("page.searchPlaceholder")}
          aria-label={t("page.searchPlaceholder")}
          suffix={<Icon.Search size={14} style={s.searchIcon} />}
        />
      </div>
      <div style={s.list}>
        {isLoading ? (
          <>
            <Skeleton height={72} style={s.skeleton} />
            <Skeleton height={72} style={s.skeleton} />
          </>
        ) : isError ? (
          <div role="alert" style={s.note}>
            {t("page.loadError")}
          </div>
        ) : skills && skills.length === 0 && query.trim() ? (
          <div style={s.note}>{t("page.noMatch.title")}</div>
        ) : (
          (skills ?? []).map((sk) => (
            <SkillCard
              key={sk.id}
              skill={sk}
              active={sk.id === activeId}
              onClick={() => onSelect(sk.id)}
              onToggle={(enabled) => onToggle(sk.id, enabled)}
            />
          ))
        )}
      </div>
    </div>
  );
}
