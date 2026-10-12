import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../lib/toast";

const restoreMutate = vi.fn();

const SKILL: Skill = {
  id: "sk1",
  name: "untested-branches",
  description: "Flag new branches without a covering test.",
  type: "rubric",
  source: "manual",
  body: "# Rule\nnew line",
  enabled: true,
  version: 2,
};

const VERSIONS: SkillVersion[] = [
  { ...SKILL, skill_id: "sk1", version: 2, note: "Tightened scope rule", created_at: "2026-10-01T10:00:00Z" },
  { ...SKILL, skill_id: "sk1", version: 1, body: "# Rule\nold line", note: null, created_at: "2026-09-30T10:00:00Z" },
];

vi.mock("../../../../../../lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSkillVersion: (_id: string, v: number) => ({
    data: VERSIONS.find((x) => x.version === v),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useRestoreSkillVersion: () => ({ mutate: restoreMutate, isPending: false }),
}));

import { VersionsTab } from "./VersionsTab";

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <VersionsTab skill={SKILL} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => restoreMutate.mockReset());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VersionsTab", () => {
  it("lists versions with note or dash and marks the current one", () => {
    renderTab();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Tightened scope rule")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    // The current version has no Diff/Restore actions.
    expect(screen.queryByRole("button", { name: "Restore v2" })).not.toBeInTheDocument();
  });

  it("opens a line diff of the selected version vs current", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole("button", { name: "Diff v1" }));

    const diff = screen.getByTestId("version-diff");
    expect(within(diff).getByText("- old line")).toHaveAttribute("data-kind", "del");
    expect(within(diff).getByText("+ new line")).toHaveAttribute("data-kind", "add");
  });

  it("restores only after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderTab();

    await user.click(screen.getByRole("button", { name: "Restore v1" }));
    expect(restoreMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Restore v1" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(restoreMutate).toHaveBeenCalledTimes(1);
    expect(restoreMutate.mock.calls[0]![0]).toEqual({ id: "sk1", version: 1 });
  });
});
