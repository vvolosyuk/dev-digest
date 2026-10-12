import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/runs.json";
import { TraceBody } from "./TraceBody";

afterEach(cleanup);

const BASE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, cost_usd: 0.0013, findings: 0, grounding: "0/0 passed" },
  prompt_assembly: { system: "You are a reviewer.", skills: "### skill", memory: null, specs: null, user: "Review PR #482" },
  tool_calls: [],
  raw_output: "{}",
  memory_pulled: [],
  specs_read: [],
  log: [],
};

function renderTrace(trace: RunTrace) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <TraceBody trace={trace} findings={[]} />
    </NextIntlClientProvider>,
  );
}

describe("TraceBody prompt assembly token counts", () => {
  it("shows +N tokens on the skills block and N tokens on the other slots", async () => {
    const user = userEvent.setup();
    renderTrace({
      ...BASE,
      prompt_assembly: { ...BASE.prompt_assembly, tokens: { system: 120, skills: 342, user: 2048 } },
    });
    await user.click(screen.getByText("Prompt assembly"));

    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.getByText("+342 tokens")).toBeInTheDocument();
    expect(screen.getByText("120 tokens")).toBeInTheDocument();
    expect(screen.getByText("2,048 tokens")).toBeInTheDocument();
  });

  it("shows no token counts for traces recorded without them", async () => {
    const user = userEvent.setup();
    renderTrace(BASE);
    await user.click(screen.getByText("Prompt assembly"));

    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.queryByText(/tokens?$/)).not.toBeInTheDocument();
  });
});
