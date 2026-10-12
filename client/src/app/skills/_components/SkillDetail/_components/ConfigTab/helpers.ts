import type { Skill, SkillType } from "@devdigest/shared";
import type { UpdateSkillInput } from "../../../../../../lib/hooks/skills";

/** Pure helpers for ConfigTab. */

/** The versioned fields of a skill (a change to any of them bumps `version`). */
export interface ConfigForm {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/** Defaults for a brand-new skill (create mode). */
export const EMPTY_FORM: ConfigForm = { name: "", description: "", type: "rubric", body: "" };

export function formFromSkill(skill: Skill | undefined): ConfigForm {
  if (!skill) return EMPTY_FORM;
  return { name: skill.name, description: skill.description, type: skill.type, body: skill.body };
}

/** Trim free-text fields the way the server validates them. */
export function normalizeForm(form: ConfigForm): ConfigForm {
  return { ...form, name: form.name.trim(), description: form.description.trim() };
}

/** Only the fields that changed (+ the version title as `note` when content changed). */
export function diffPatch(initial: ConfigForm, form: ConfigForm, note: string): UpdateSkillInput["patch"] {
  const patch: UpdateSkillInput["patch"] = {};
  if (form.name !== initial.name) patch.name = form.name;
  if (form.description !== initial.description) patch.description = form.description;
  if (form.type !== initial.type) patch.type = form.type;
  if (form.body !== initial.body) patch.body = form.body;
  if (Object.keys(patch).length > 0 && note.trim()) patch.note = note.trim();
  return patch;
}

export function isDirty(initial: ConfigForm, form: ConfigForm): boolean {
  return (Object.keys(initial) as (keyof ConfigForm)[]).some((k) => initial[k] !== form[k]);
}
