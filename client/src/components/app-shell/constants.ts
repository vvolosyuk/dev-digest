import type { NavItemDef, ShortcutDef } from "@devdigest/ui";

/** Constants for AppShell (extracted magic values). */

/** Window (ms) to press the second key of a `g`-then-key navigation chord. */
export const G_NAV_TIMEOUT_MS = 1200;

/** Sidebar section that groups Skills + Agents (L02). */
export const SKILLS_LAB_SECTION = "SKILLS LAB";

/** Nav entry for the Skills page — added locally, `vendor/ui/nav.ts` stays untouched. */
export const SKILLS_NAV_ITEM: NavItemDef = {
  key: "skills",
  label: "Skills",
  icon: "Sparkles",
  href: "/skills",
  gKey: "s",
};

/** Shortcut-help row for `g s`. */
export const SKILLS_SHORTCUT: ShortcutDef = { keys: "g s", label: "Go to Skills", group: "Navigation" };
