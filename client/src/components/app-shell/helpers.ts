/** Pure helpers for AppShell. */

import type { NavGroup, RepoSummary, ShortcutDef } from "@devdigest/ui";
import type { Repo } from "../../lib/types";
import { SKILLS_LAB_SECTION, SKILLS_NAV_ITEM, SKILLS_SHORTCUT } from "./constants";

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
 * Nav groups with a "SKILLS LAB" section (Skills + Agents, Agents moved out of
 * its original group). Idempotent: an already-overridden nav comes back unchanged (as a copy).
 */
export function withSkillsLab(nav: readonly NavGroup[]): NavGroup[] {
  if (nav.some((g) => g.section === SKILLS_LAB_SECTION)) return [...nav];
  const agents = nav.flatMap((g) => g.items).find((it) => it.key === "agents");
  const rest = nav
    .map((g) => ({ ...g, items: g.items.filter((it) => it.key !== "agents" && it.key !== SKILLS_NAV_ITEM.key) }))
    .filter((g) => g.items.length > 0);
  return [...rest, { section: SKILLS_LAB_SECTION, items: agents ? [SKILLS_NAV_ITEM, agents] : [SKILLS_NAV_ITEM] }];
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
  if (!shortcuts.some((s) => s.keys === SKILLS_SHORTCUT.keys)) {
    const at = shortcuts.findIndex((s) => s.keys === "g a");
    shortcuts.splice(at >= 0 ? at + 1 : shortcuts.length, 0, SKILLS_SHORTCUT);
  }
}
