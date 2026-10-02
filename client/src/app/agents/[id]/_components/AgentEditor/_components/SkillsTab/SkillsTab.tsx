/* SkillsTab — attach workspace skills to an agent and order them. Every change
   (check, uncheck, ↑/↓, drag) sends the full ordered link set via
   `PUT /agents/:id/skills`; the hook updates the list optimistically. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, Skeleton, TextInput } from "@devdigest/ui";
import { useAgentSkills, useSetAgentSkills, useSkills } from "../../../../../../../lib/hooks/skills";
import {
  buildRows,
  matchesFilter,
  moveLink,
  moveLinkTo,
  toggleLink,
  toOrderedLinks,
  type LinkInput,
} from "./helpers";
import { SkillRow } from "./_components/SkillRow";
import { s } from "./styles";

export function SkillsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("agents");
  const [filter, setFilter] = React.useState("");
  const skillsQ = useSkills();
  const linksQ = useAgentSkills(agentId);
  const setLinks = useSetAgentSkills();

  if (skillsQ.isLoading || linksQ.isLoading) {
    return (
      <div style={s.loading}>
        <Skeleton height={24} width={240} />
        <Skeleton height={160} />
      </div>
    );
  }
  if (skillsQ.isError || linksQ.isError) return <p style={s.error}>{t("skills.loadError")}</p>;

  const skills = skillsQ.data ?? [];
  const links = linksQ.data ?? [];
  if (skills.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skills.emptyTitle")}
        body={
          <>
            {t("skills.emptyBody")}{" "}
            <Link href="/skills" style={s.emptyLink}>
              {t("skills.emptyCta")}
            </Link>
          </>
        }
      />
    );
  }

  const rows = buildRows(skills, links);
  const ordered = toOrderedLinks(links);
  const linkedIds = rows.filter((r) => r.link).map((r) => r.skill.id);
  const enabledCount = rows.filter((r) => r.link?.enabled).length;
  const visible = rows.filter((r) => matchesFilter(r.skill, filter));
  const save = (next: LinkInput[]) => setLinks.mutate({ agentId, links: next });

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { linked: enabledCount, total: skills.length })}
        </Badge>
      </div>
      <TextInput
        value={filter}
        onChange={setFilter}
        placeholder={t("skills.filterPlaceholder")}
        aria-label={t("skills.filterPlaceholder")}
      />
      <p style={s.hint}>{t("skills.orderHint")}</p>
      <div style={s.list}>
        {visible.length === 0 && <p style={s.note}>{t("skills.noMatches", { q: filter.trim() })}</p>}
        {visible.map((row) => {
          const pos = linkedIds.indexOf(row.skill.id);
          return (
            <SkillRow
              key={row.skill.id}
              row={row}
              canMoveUp={pos > 0}
              canMoveDown={pos >= 0 && pos < linkedIds.length - 1}
              onToggle={() => save(toggleLink(ordered, row.skill.id))}
              onMove={(delta) => save(moveLink(ordered, row.skill.id, delta))}
              onDropOn={(draggedId) => save(moveLinkTo(ordered, draggedId, row.skill.id))}
            />
          );
        })}
      </div>
    </div>
  );
}
