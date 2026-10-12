import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Convention } from "@/lib/hooks/conventions";
import messages from "../../../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

const CONV: Convention = {
  id: "c1",
  category: "data-access",
  rule: "Redis access goes through src/lib/redis.ts singleton",
  evidence_path: "src/lib/redis.ts",
  evidence_line_start: 3,
  evidence_line_end: 4,
  evidence_snippet: "import Redis from 'ioredis';\nexport const redis = new Redis(config.redisUrl);",
  confidence: 0.85,
  status: "pending",
  accepted: false,
  created_at: "2026-10-01T00:00:00.000Z",
};

function renderCard(over: Partial<Convention> = {}) {
  const onStatus = vi.fn();
  const onEdit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard convention={{ ...CONV, ...over }} onStatus={onStatus} onEdit={onEdit} />
    </NextIntlClientProvider>,
  );
  return { onStatus, onEdit };
}

afterEach(cleanup);

describe("ConventionCard", () => {
  it("shows rule, category, evidence ref with numbered lines and confidence", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: CONV.rule })).toBeTruthy();
    expect(screen.getByText("data-access")).toBeTruthy();
    expect(screen.getByText("src/lib/redis.ts:3-4")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy(); // second snippet line is numbered 4
    expect(screen.getByText("85%")).toBeTruthy();
  });

  it("accepts / rejects a pending candidate", async () => {
    const user = userEvent.setup();
    const { onStatus } = renderCard();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(onStatus.mock.calls).toEqual([["accepted"], ["rejected"]]);
  });

  it("clicking the active decision resets it to pending", async () => {
    const user = userEvent.setup();
    const { onStatus } = renderCard({ status: "accepted", accepted: true });
    const btn = screen.getByRole("button", { name: "Accepted" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    await user.click(btn);
    expect(onStatus).toHaveBeenCalledWith("pending");
  });

  it("edits rule + category inline", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderCard();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const rule = screen.getByLabelText("Rule");
    await user.clear(rule);
    await user.type(rule, "Use the shared redis client");
    const category = screen.getByLabelText("Category");
    await user.clear(category);
    await user.type(category, "infra");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith({ rule: "Use the shared redis client", category: "infra" });
  });

  it("blocks saving a too-short rule", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderCard();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Rule"));
    expect(screen.getByRole("alert").textContent).toMatch(/at least 3/);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
