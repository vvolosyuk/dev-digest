import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "untested-branches",
  description: "Flag new branches without a covering test.",
  type: "rubric",
  source: "manual",
  body: "# Rule",
  enabled: true,
  version: 2,
  agent_count: 3,
};

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SkillCard", () => {
  it("renders name, description, type, source and agent count", () => {
    renderCard(<SkillCard skill={SKILL} />);
    expect(screen.getByText("untested-branches")).toBeInTheDocument();
    expect(screen.getByText("Flag new branches without a covering test.")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("3 agents")).toBeInTheDocument();
    expect(screen.queryByText("needs vetting")).not.toBeInTheDocument();
  });

  it("toggling enabled does not open the card", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onToggle = vi.fn();
    renderCard(<SkillCard skill={SKILL} onClick={onClick} onToggle={onToggle} />);

    await user.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByText("untested-branches"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("flags never-edited imported skills as needing vetting", () => {
    renderCard(<SkillCard skill={{ ...SKILL, source: "imported_url", version: 1 }} />);
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByText("needs vetting")).toBeInTheDocument();
  });
});
