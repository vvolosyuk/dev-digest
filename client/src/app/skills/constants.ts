import type { IconName } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

/** Constants shared by the /skills route's components. */

/** Selectable skill types, in display order. */
export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Mirrors the server's Zod validation (`server/src/modules/skills`). */
export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 300;
export const BODY_MAX = 20_000;

/** Type → icon shown on cards and in the detail header. */
export const SKILL_TYPE_ICON: Record<SkillType, IconName> = {
  rubric: "ListChecks",
  convention: "FileText",
  security: "Shield",
  custom: "Sparkles",
};

/** Type → badge colours (rubric=accent, convention=green, security=red, custom=muted). */
export const SKILL_TYPE_COLOR: Record<SkillType, { color: string; bg: string }> = {
  rubric: { color: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg)" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { color: "var(--text-muted)", bg: "var(--bg-hover)" },
};
