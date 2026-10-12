import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../lib/toast";

const push = vi.fn();
const replace = vi.fn();
let routeId: string | undefined = "sk1";
let skills: Skill[] = [];

vi.mock("next/navigation", () => ({
  useParams: () => (routeId ? { id: routeId } : {}),
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams("tab=config"),
}));

vi.mock("../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills, isLoading: false, isError: false }),
  useSkill: (id: string | null) => ({
    data: skills.find((s) => s.id === id),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillsView } from "./SkillsView";

const SKILL: Skill = {
  id: "sk1",
  name: "untested-branches",
  description: "Flag new branches without a covering test.",
  type: "rubric",
  source: "manual",
  body: "# Rule",
  enabled: true,
  version: 2,
  agent_count: 1,
};

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <SkillsView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  routeId = "sk1";
  skills = [SKILL, { ...SKILL, id: "sk2", name: "over-mocking", type: "convention" }];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SkillsView", () => {
  it("shows the empty state when there are no skills", () => {
    routeId = undefined;
    skills = [];
    renderView();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });

  it("renders the selected skill header with a disabled Run on evals", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1, name: "untested-branches" })).toBeInTheDocument();
    // Version shows in both the page header and the Config tab header.
    expect(screen.getAllByText("v2")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Run on evals/ })).toBeDisabled();
  });

  it("guards unsaved Config edits when switching skills", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView();

    await user.type(screen.getByLabelText("Name"), "-x");
    await user.click(screen.getByText("over-mocking"));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByText("over-mocking"));
    expect(push).toHaveBeenCalledWith("/skills/sk2?tab=config");
  });

  it("switches tabs through ?tab=", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(replace).toHaveBeenCalledWith("/skills/sk1?tab=preview");
  });
});
