import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../lib/toast";

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("../../../../../../lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: createMutate, isPending: false }),
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: false }),
}));

import { ConfigTab } from "./ConfigTab";

const SKILL: Skill = {
  id: "sk1",
  name: "untested-branches",
  description: "Flag new branches without a covering test.",
  type: "rubric",
  source: "manual",
  body: "# Rule\nEvery branch needs a test.",
  enabled: true,
  version: 2,
};

function renderTab(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  createMutate.mockReset();
  updateMutate.mockReset();
});
afterEach(cleanup);

describe("ConfigTab", () => {
  it("renders the skill and keeps Save disabled until something changes", () => {
    renderTab(<ConfigTab skill={SKILL} />);
    expect(screen.getByLabelText("Name")).toHaveValue("untested-branches");
    expect(screen.getByText("untested-branches.md")).toBeInTheDocument();
    expect(screen.getByText(/Describe when the agent should apply this skill/)).toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("marks edits as unsaved, reports dirty, and shows the token estimate", async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    renderTab(<ConfigTab skill={SKILL} onDirtyChange={onDirtyChange} />);

    const body = screen.getByLabelText("Skill body (Markdown)");
    await user.clear(body);
    await user.type(body, "abcdefgh");
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByText("~2 tokens")).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("shows validation errors and does not save an invalid form", async () => {
    const user = userEvent.setup();
    renderTab(<ConfigTab skill={SKILL} />);

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Bad Name");
    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "short");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText(/Use lowercase letters, digits and dashes/)).toBeInTheDocument();
    expect(screen.getByText("Description must be 10–300 characters.")).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("Save opens the version dialog; confirming saves the changed fields plus the title", async () => {
    const user = userEvent.setup();
    renderTab(<ConfigTab skill={SKILL} />);

    const body = screen.getByLabelText("Skill body (Markdown)");
    await user.type(body, " Including else.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Nothing is saved until the dialog is confirmed; the dialog shows the diff.
    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("version-diff")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Version title"), "Tightened scope rule");
    await user.click(screen.getByRole("button", { name: `Save as v${SKILL.version + 1}` }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]![0]).toEqual({
      id: "sk1",
      patch: { body: "# Rule\nEvery branch needs a test. Including else.", note: "Tightened scope rule" },
    });
  });

  it("cancelling the version dialog saves nothing and keeps the edits", async () => {
    const user = userEvent.setup();
    renderTab(<ConfigTab skill={SKILL} />);

    await user.type(screen.getByLabelText("Skill body (Markdown)"), " Including else.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Version title")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Skill body (Markdown)")).toHaveValue(
      "# Rule\nEvery branch needs a test. Including else.",
    );
  });

  it("Cancel discards local edits", async () => {
    const user = userEvent.setup();
    renderTab(<ConfigTab skill={SKILL} />);
    await user.type(screen.getByLabelText("Name"), "-x");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Name")).toHaveValue("untested-branches");
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });

  it("creates a manual skill in create mode", async () => {
    const user = userEvent.setup();
    renderTab(<ConfigTab />);

    await user.type(screen.getByLabelText("Name"), "over-mocking");
    await user.type(screen.getByLabelText("Description"), "Flag tests that mock the unit under test.");
    await user.type(screen.getByLabelText("Skill body (Markdown)"), "# Over-mocking");
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]![0]).toEqual({
      name: "over-mocking",
      description: "Flag tests that mock the unit under test.",
      type: "rubric",
      body: "# Over-mocking",
      enabled: true,
      source: "manual",
    });
  });
});
