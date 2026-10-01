/**
 * Characterization test for the /agents/:id page's sidebar list + editor
 * header markup, written BEFORE it's extracted into `_components/` (see the
 * improvement plan, Tier 0 item 0b / Tier 1 item 2). `AgentEditor.test.tsx`
 * covers the nested editor; nothing today covers this page's own sidebar
 * list (active-card highlight, add-agent control) or header (name, provider
 * chip, disabled badge). This locks that down so the extraction can be
 * verified not to change it.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../messages/en/agents.json";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ag1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./_components/AgentEditor", () => ({
  AgentEditor: () => <div data-testid="agent-editor" />,
}));

const AGENT_1: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

const AGENT_2: Agent = {
  ...AGENT_1,
  id: "ag2",
  name: "Style Checker",
  enabled: false,
};

const updateMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("../../../lib/hooks/agents", () => ({
  useAgents: () => ({ data: [AGENT_1, AGENT_2] }),
  useAgent: () => ({ data: AGENT_1, isLoading: false, isError: false, error: undefined, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: updateMutate }),
  useDeleteAgent: () => ({ mutate: deleteMutate, isPending: false }),
}));

import AgentEditorPage from "./page";

afterEach(cleanup);

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <AgentEditorPage />
    </NextIntlClientProvider>,
  );
}

describe("/agents/:id page (sidebar + header, pre-extraction characterization)", () => {
  it("renders both agents in the sidebar, highlights the active one, and shows the selected agent's header", () => {
    renderPage();

    // Sidebar lists every agent. The active agent's name also appears in the
    // header, so it matches twice; the inactive one matches once.
    expect(screen.getAllByText("Security Reviewer").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Style Checker")).toBeInTheDocument();

    // Header shows the active agent's provider/model chip and no disabled
    // badge (AGENT_1 is enabled).
    expect(screen.getByText("openai/gpt-4.1")).toBeInTheDocument();
    expect(screen.queryByText("disabled")).not.toBeInTheDocument();

    // The nested editor renders for the active agent.
    expect(screen.getByTestId("agent-editor")).toBeInTheDocument();
  });
});
