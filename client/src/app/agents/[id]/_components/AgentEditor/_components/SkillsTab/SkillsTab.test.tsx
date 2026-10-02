import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

const mocks = vi.hoisted(() => ({
  skills: [] as Skill[],
  links: [] as AgentSkillLink[],
  mutate: vi.fn(),
}));

// Mock the data hooks so the tab renders without a network/query client.
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: mocks.skills, isLoading: false, isError: false }),
  useAgentSkills: () => ({ data: mocks.links, isLoading: false, isError: false }),
  useSetAgentSkills: () => ({ mutate: mocks.mutate, isPending: false }),
}));

import { SkillsTab } from "./SkillsTab";

function skill(id: string, name: string, extra: Partial<Skill> = {}): Skill {
  return {
    id,
    name,
    description: `${name} rules`,
    type: "convention",
    source: "manual",
    body: "- rule",
    enabled: true,
    version: 1,
    ...extra,
  } as Skill;
}

function link(skill_id: string, order: number, enabled = true): AgentSkillLink {
  return { agent_id: "ag1", skill_id, order, enabled };
}

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agentId="ag1" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.skills = [
    skill("s-sql", "sql-injection", { type: "security" }),
    skill("s-naming", "naming"),
    skill("s-api", "api-errors"),
    skill("s-old", "legacy-rules", { enabled: false }),
  ];
  // Linked in a non-alphabetical order; "naming" is linked but disabled for this agent.
  mocks.links = [link("s-sql", 0), link("s-naming", 1, false)];
});
afterEach(cleanup);

const lastPayload = () => mocks.mutate.mock.lastCall?.[0];

describe("SkillsTab", () => {
  it("lists linked skills first in link order, shows the counter, and toggles links", async () => {
    const user = userEvent.setup();
    renderTab();

    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();
    const names = screen.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent);
    expect(names).toEqual(["sql-injection", "naming", "api-errors", "legacy-rules"]);

    // Linked + enabled → unchecking keeps the link, disables it in place.
    await user.click(screen.getByRole("checkbox", { name: "sql-injection" }));
    expect(lastPayload()).toEqual({
      agentId: "ag1",
      links: [
        { skill_id: "s-sql", enabled: false },
        { skill_id: "s-naming", enabled: false },
      ],
    });

    // Linked + disabled → re-enabled in place.
    await user.click(screen.getByRole("checkbox", { name: "naming" }));
    expect(lastPayload().links).toEqual([
      { skill_id: "s-sql", enabled: true },
      { skill_id: "s-naming", enabled: true },
    ]);

    // Unlinked → appended to the end of the linked set, enabled.
    await user.click(screen.getByRole("checkbox", { name: "api-errors" }));
    expect(lastPayload().links).toEqual([
      { skill_id: "s-sql", enabled: true },
      { skill_id: "s-naming", enabled: false },
      { skill_id: "s-api", enabled: true },
    ]);
  });

  it("reorders linked skills with the ↑/↓ buttons", async () => {
    const user = userEvent.setup();
    renderTab();

    expect(screen.getByRole("button", { name: "Move sql-injection up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move naming down" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Move api-errors up" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move sql-injection down" }));
    expect(lastPayload()).toEqual({
      agentId: "ag1",
      links: [
        { skill_id: "s-naming", enabled: false },
        { skill_id: "s-sql", enabled: true },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Move naming up" }));
    expect(lastPayload().links).toEqual([
      { skill_id: "s-naming", enabled: false },
      { skill_id: "s-sql", enabled: true },
    ]);
  });

  it("disables the checkbox of a globally disabled skill and filters the list", async () => {
    const user = userEvent.setup();
    renderTab();

    const legacy = screen.getByRole("checkbox", { name: "legacy-rules" });
    expect(legacy).toBeDisabled();
    expect(screen.getByText("disabled globally")).toBeInTheDocument();
    await user.click(legacy);
    expect(mocks.mutate).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Filter skills…" }), "nam");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "naming" })).toBeInTheDocument();
  });

  it("shows an empty state linking to the Skills page when the workspace has no skills", () => {
    mocks.skills = [];
    mocks.links = [];
    renderTab();

    expect(screen.getByText("No skills yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Skills" })).toHaveAttribute("href", "/skills");
  });
});
