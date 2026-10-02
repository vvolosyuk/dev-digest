/* SkillDiff — changed name/description/type rows plus a line diff of the
   body between two snapshots of a skill. Shared by VersionDiffModal (old
   version → current) and SaveVersionModal (saved → unsaved edits). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { SkillType } from "@devdigest/shared";
import { DIFF_PREFIX, META_FIELDS } from "./constants";
import { hasChanges, lineDiff } from "./helpers";
import { s } from "./styles";

/** The versioned fields of a skill snapshot. */
export interface SkillSnapshot {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

export function SkillDiff({
  before,
  after,
  maxHeight,
}: {
  before: SkillSnapshot;
  after: SkillSnapshot;
  /** Override the body box height (e.g. when the modal has more above it). */
  maxHeight?: string;
}) {
  const t = useTranslations("skills");
  const metaChanges = META_FIELDS.filter((f) => before[f] !== after[f]);
  const diff = lineDiff(before.body, after.body);

  if (metaChanges.length === 0 && !hasChanges(diff)) {
    return <div style={s.note}>{t("diff.noChanges")}</div>;
  }

  return (
    <>
      {metaChanges.map((f) => (
        <div key={f} style={s.metaRow}>
          <div style={s.metaLabel}>{t(`diff.field.${f}`)}</div>
          <div className="mono" style={s.line("del")}>
            {DIFF_PREFIX.del + before[f]}
          </div>
          <div className="mono" style={s.line("add")}>
            {DIFF_PREFIX.add + after[f]}
          </div>
        </div>
      ))}
      <div style={s.metaLabel}>{t("diff.body")}</div>
      <div style={maxHeight ? { ...s.diffBox, maxHeight } : s.diffBox} data-testid="version-diff">
        {diff.map((l, i) => (
          <div key={i} className="mono" data-kind={l.kind} style={s.line(l.kind)}>
            {DIFF_PREFIX[l.kind] + l.text}
          </div>
        ))}
      </div>
    </>
  );
}
