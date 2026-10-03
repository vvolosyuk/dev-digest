/** Pure helpers for AppShell. */

import type { NavGroup, RepoSummary, ShortcutDef } from "@devdigest/ui";
import type { Repo } from "../../lib/types";
import {
  CONVENTIONS_NAV_ITEM,
  CONVENTIONS_SHORTCUT,
  SKILLS_LAB_SECTION,
  SKILLS_NAV_ITEM,
  SKILLS_SHORTCUT,
} from "./constants";

/** Map a lib `Repo` to the `RepoSummary` shape the AppFrame shell context expects. */
export function toShellRepo(r: Repo): RepoSummary {
  return {
    id: r.id,
    full_name: r.full_name,
    default_branch: r.default_branch,
    syncedLabel: r.last_polled_at ? "synced" : "not synced",
  };
}

/** Whether an event target is a text-entry element (guards typing-aware shortcuts). */
export function isTextInput(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return (
    !!node &&
    (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable)
  );
}

/** Derive the active sidebar key from the current pathname. */
export function activeKeyFor(pathname: string): string {
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.includes("/multi-agent")) return "multi-agent";
  if (pathname.includes("/onboarding")) return "onboarding-tour";
  if (pathname.includes("/context")) return "context";
  if (pathname.includes("/conventions")) return "conventions";
  if (pathname.includes("/pulls")) return "pulls";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/agents")) return "agents";
  if (pathname.startsWith("/eval")) return "eval";
  if (pathname.startsWith("/memory")) return "memory";
  if (pathname.startsWith("/agent-performance")) return "agent-performance";
  if (pathname.startsWith("/ci-runs")) return "ci-runs";
  return "";
}

/**
 * Nav groups with a "SKILLS LAB" section (Skills + Agents + Conventions, Agents
 * moved out of its original group). Idempotent: an already-overridden nav comes back unchanged (as a copy).
 */
export function withSkillsLab(nav: readonly NavGroup[]): NavGroup[] {
  if (nav.some((g) => g.section === SKILLS_LAB_SECTION)) return [...nav];
  const agents = nav.flatMap((g) => g.items).find((it) => it.key === "agents");
  const lab = new Set(["agents", SKILLS_NAV_ITEM.key, CONVENTIONS_NAV_ITEM.key]);
  const rest = nav
    .map((g) => ({ ...g, items: g.items.filter((it) => !lab.has(it.key)) }))
    .filter((g) => g.items.length > 0);
  const items = agents
    ? [SKILLS_NAV_ITEM, agents, CONVENTIONS_NAV_ITEM]
    : [SKILLS_NAV_ITEM, CONVENTIONS_NAV_ITEM];
  return [...rest, { section: SKILLS_LAB_SECTION, items }];
}

/**
 * Apply the Skills Lab nav override in place. The vendored Sidebar, the
 * g-chord shortcuts and the command palette all read `NAV` / `SHORTCUTS`
 * directly from `@devdigest/ui`, and `vendor/ui/nav.ts` must not be edited —
 * so the shared arrays are patched once, at AppShell module load.
 */
export function applyNavOverride(nav: NavGroup[], shortcuts: ShortcutDef[]): void {
  const next = withSkillsLab(nav);
  nav.splice(0, nav.length, ...next);
  insertShortcutAfter(shortcuts, "g a", SKILLS_SHORTCUT);
  insertShortcutAfter(shortcuts, SKILLS_SHORTCUT.keys, CONVENTIONS_SHORTCUT);
}

/** Insert `def` right after the `after` row (or at the end), once. */
function insertShortcutAfter(shortcuts: ShortcutDef[], after: string, def: ShortcutDef): void {
  if (shortcuts.some((s) => s.keys === def.keys)) return;
  const at = shortcuts.findIndex((s) => s.keys === after);
  shortcuts.splice(at >= 0 ? at + 1 : shortcuts.length, 0, def);
}
