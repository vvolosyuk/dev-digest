import { describe, it, expect } from "vitest";
import type { NavGroup, ShortcutDef } from "@devdigest/ui";
import { activeKeyFor, applyNavOverride, withSkillsLab } from "./helpers";

const BASE: NavGroup[] = [
  {
    section: "WORKSPACE",
    items: [
      { key: "pulls", label: "Pull Requests", icon: "GitPullRequest", href: "/repos/:repoId/pulls", gKey: "p" },
      { key: "agents", label: "Agents", icon: "Cpu", href: "/agents", gKey: "a" },
    ],
  },
];

describe("withSkillsLab", () => {
  it("moves Agents into a SKILLS LAB group led by Skills", () => {
    const nav = withSkillsLab(BASE);
    expect(nav.map((g) => g.section)).toEqual(["WORKSPACE", "SKILLS LAB"]);
    expect(nav[0]!.items.map((i) => i.key)).toEqual(["pulls"]);
    expect(nav[1]!.items.map((i) => [i.key, i.href, i.icon, i.gKey])).toEqual([
      ["skills", "/skills", "Sparkles", "s"],
      ["agents", "/agents", "Cpu", "a"],
    ]);
  });

  it("is idempotent", () => {
    const once = withSkillsLab(BASE);
    expect(withSkillsLab(once)).toEqual(once);
  });
});

describe("applyNavOverride", () => {
  it("patches the shared arrays in place, once", () => {
    const nav = structuredClone(BASE);
    const shortcuts: ShortcutDef[] = [
      { keys: "g p", label: "Go to Pull Requests", group: "Navigation" },
      { keys: "g a", label: "Go to Agents", group: "Navigation" },
      { keys: "j / k", label: "Next / previous finding", group: "Findings" },
    ];
    applyNavOverride(nav, shortcuts);
    applyNavOverride(nav, shortcuts);
    expect(nav.map((g) => g.section)).toEqual(["WORKSPACE", "SKILLS LAB"]);
    expect(shortcuts.map((s) => s.keys)).toEqual(["g p", "g a", "g s", "j / k"]);
  });
});

describe("activeKeyFor", () => {
  it("resolves /skills routes to the skills nav key", () => {
    expect(activeKeyFor("/skills")).toBe("skills");
    expect(activeKeyFor("/skills/abc")).toBe("skills");
    expect(activeKeyFor("/agents/x")).toBe("agents");
  });
});
