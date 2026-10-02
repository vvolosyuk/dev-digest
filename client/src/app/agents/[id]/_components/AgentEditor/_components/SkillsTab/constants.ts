import type { SkillType } from "@devdigest/shared";

/** Type-badge colors (rubric=accent, convention=green, security=red, custom=muted). */
export const SKILL_TYPE_COLORS: Record<SkillType, { color: string; bg: string }> = {
  rubric: { color: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg)" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { color: "var(--text-muted)", bg: "var(--bg-hover)" },
};
