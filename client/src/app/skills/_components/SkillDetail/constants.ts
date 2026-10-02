import type { IconName } from "@devdigest/ui";

/** Skill detail tab descriptor. `lesson` marks a stub tab delivered later. */
export interface SkillTab {
  key: string;
  icon: IconName;
  lesson?: string;
}

/** Tabs of the skill detail pane; label = `skills.tabs.<key>`. */
export const SKILL_TABS: readonly SkillTab[] = [
  { key: "config", icon: "Settings" },
  { key: "preview", icon: "Eye" },
  { key: "versions", icon: "History" },
  { key: "context", icon: "Layers", lesson: "L05" },
  { key: "evals", icon: "FlaskConical", lesson: "L06" },
  { key: "stats", icon: "BarChart", lesson: "L07" },
];

/** Values accepted in `?tab=`; anything else falls back to "config". */
export const VALID_TABS: readonly string[] = SKILL_TABS.map((t) => t.key);
