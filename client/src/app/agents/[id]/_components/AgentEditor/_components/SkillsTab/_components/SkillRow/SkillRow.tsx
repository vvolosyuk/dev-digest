/* SkillRow — one workspace skill in the agent's Skills tab: drag handle,
   checkbox, mono name, type badge, ↑/↓ reorder buttons (linked rows only). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, Icon } from "@devdigest/ui";
import type { SkillRowModel } from "../../helpers";
import { SKILL_TYPE_COLORS } from "../../constants";
import { s } from "./styles";

const DND_MIME = "text/plain";

export function SkillRow({
  row,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMove,
  onDropOn,
}: {
  row: SkillRowModel;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onMove: (delta: -1 | 1) => void;
  /** Called on the drop target with the dragged skill's id. */
  onDropOn: (draggedId: string) => void;
}) {
  const t = useTranslations("agents");
  const { skill, link } = row;
  const linked = link != null;
  const globallyDisabled = !skill.enabled;
  const checked = linked && link.enabled;
  const typeColors = SKILL_TYPE_COLORS[skill.type];

  return (
    <div
      style={s.row(checked && !globallyDisabled)}
      draggable={linked}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, skill.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (linked) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dragged = e.dataTransfer.getData(DND_MIME);
        if (linked && dragged && dragged !== skill.id) onDropOn(dragged);
      }}
    >
      <span style={s.handle(linked)} title={linked ? t("skills.dragHandle") : undefined} aria-hidden>
        <Icon.Menu size={14} />
      </span>
      {/* The kit Checkbox has no `disabled` prop — a disabled fieldset disables its button. */}
      <fieldset disabled={globallyDisabled} style={s.fieldset}>
        <Checkbox
          checked={checked}
          onChange={() => {
            if (!globallyDisabled) onToggle();
          }}
          label={
            <span className="mono" style={s.name}>
              {skill.name}
            </span>
          }
        />
      </fieldset>
      <Badge color={typeColors.color} bg={typeColors.bg}>
        {t(`skills.types.${skill.type}`)}
      </Badge>
      {globallyDisabled && (
        <span title={t("skills.disabledGloballyHint")}>
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Slash">
            {t("skills.disabledGlobally")}
          </Badge>
        </span>
      )}
      <span style={s.moveBtns}>
        {linked && (
          <>
            <button
              type="button"
              style={s.moveBtn(canMoveUp)}
              disabled={!canMoveUp}
              aria-label={t("skills.moveUp", { name: skill.name })}
              title={t("skills.moveUp", { name: skill.name })}
              onClick={() => onMove(-1)}
            >
              <Icon.ArrowUp size={13} />
            </button>
            <button
              type="button"
              style={s.moveBtn(canMoveDown)}
              disabled={!canMoveDown}
              aria-label={t("skills.moveDown", { name: skill.name })}
              title={t("skills.moveDown", { name: skill.name })}
              onClick={() => onMove(1)}
            >
              <Icon.ArrowDown size={13} />
            </button>
          </>
        )}
      </span>
    </div>
  );
}
