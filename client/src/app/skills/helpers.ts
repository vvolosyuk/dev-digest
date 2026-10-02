import type { Skill, SkillType } from "@devdigest/shared";
import { BODY_MAX, DESCRIPTION_MAX, DESCRIPTION_MIN, SKILL_NAME_RE } from "./constants";

/** Pure helpers shared by the /skills route's components. */

export interface SkillBlockInput {
  name: string;
  type: SkillType;
  version: number;
  description: string;
  body: string;
}

/**
 * Client mirror of the server's `formatSkillBlock`
 * (`server/src/modules/_shared/skill-prompt.ts`) — keep the two in sync so the
 * Preview tab shows exactly what the reviewing agent receives.
 */
export function formatSkillBlock(skill: SkillBlockInput): string {
  return `### Skill: ${skill.name} (${skill.type}, v${skill.version})\n${skill.description}\n\n${skill.body.trim()}`;
}

/** Imported skills that were never edited (still v1) need a human to vet them. */
export function needsVetting(skill: Pick<Skill, "source" | "version">): boolean {
  return skill.source === "imported_url" && skill.version === 1;
}

export interface SkillFormValues {
  name: string;
  description: string;
  body: string;
}

/** i18n keys under `skills.config.errors`, per invalid field. */
export interface SkillFormErrors {
  name?: "nameFormat";
  description?: "descriptionLength";
  body?: "bodyRequired" | "bodyTooLong";
}

/** Client-side mirror of the server's create/update validation. */
export function validateSkillForm(v: SkillFormValues): SkillFormErrors {
  const errors: SkillFormErrors = {};
  if (!SKILL_NAME_RE.test(v.name)) errors.name = "nameFormat";
  const desc = v.description.trim().length;
  if (desc < DESCRIPTION_MIN || desc > DESCRIPTION_MAX) errors.description = "descriptionLength";
  if (v.body.trim().length === 0) errors.body = "bodyRequired";
  else if (v.body.length > BODY_MAX) errors.body = "bodyTooLong";
  return errors;
}

export function hasErrors(errors: SkillFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
