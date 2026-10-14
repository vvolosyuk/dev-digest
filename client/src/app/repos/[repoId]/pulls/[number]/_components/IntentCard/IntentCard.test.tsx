/**
 * IntentCard — renders the derived PR intent through the REAL hooks, with the
 * global `fetch` stubbed (client ADR-004). Pins: full record sections, the
 * empty state + "Derive intent" mutation, and the low-confidence hint.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { IntentResponse, PrIntentRecord } from "@/lib/types";
import messages from "../../../../../../../../messages/en/brief.json";
import { IntentCard } from "./IntentCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MODEL = { provider: "openrouter", model: "anthropic/claude-haiku-4.5" };

const FULL: PrIntentRecord = {
  intent: "Adds rate limiting to the public API endpoints.",
  in_scope: ["Limiter middleware", "Per-IP counters"],
  out_of_scope: ["Billing changes"],
  confidence: "medium",
  sources: [
    { kind: "description", ref: "description", fetched: true, chars: 120 },
    { kind: "doc", ref: "docs/plans/rate-limit.md", fetched: false, note: "unavailable" },
  ],
  risk_areas: [{ label: "Auth surface touched", kind: "auth", source: "heuristic" }],
  provider: MODEL.provider,
  model: MODEL.model,
  head_sha: "a1b2c3d4",
  tokens_in: 100,
  tokens_out: 50,
  cost_usd: 0.0004,
  computed_at: "2026-10-13T10:00:00.000Z",
};

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, statusText: "", json: async () => body } as Response;
}

/** Stub fetch: GET returns `initial`; POST returns `afterPost` (and is recorded). */
function stubApi(initial: IntentResponse, afterPost?: IntentResponse) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? json(afterPost ?? initial) : json(initial),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
        <IntentCard prId="pr-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("IntentCard", () => {
  it("renders the full record: quote, scope columns, risks, confidence and sources", async () => {
    stubApi({ intent: FULL, stale: false, model: MODEL });
    renderCard();

    expect(await screen.findByText(FULL.intent)).toBeInTheDocument();
    expect(screen.getByText("IN SCOPE")).toBeInTheDocument();
    expect(screen.getByText("OUT OF SCOPE")).toBeInTheDocument();
    expect(screen.getByText("Limiter middleware")).toBeInTheDocument();
    expect(screen.getByText("Billing changes")).toBeInTheDocument();
    expect(screen.getByText("Auth surface touched")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
    expect(screen.getByText("docs/plans/rate-limit.md")).toBeInTheDocument();
    expect(screen.getByText("(not fetched)")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0004/)).toBeInTheDocument();
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    expect(screen.queryByText(/Inferred from branch/)).not.toBeInTheDocument();
  });

  it("shows the empty state; Derive intent POSTs and then shows the returned intent", async () => {
    const fetchMock = stubApi(
      { intent: null, stale: false, model: MODEL },
      { intent: FULL, stale: false, model: MODEL },
    );
    renderCard();

    expect(await screen.findByText("No intent derived yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Derive intent/ }));

    expect(await screen.findByText(FULL.intent)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toMatch(/\/pulls\/pr-1\/intent$/);
  });

  it("shows the low-confidence hint and a stale badge", async () => {
    stubApi({ intent: { ...FULL, confidence: "low" }, stale: true, model: MODEL });
    renderCard();

    expect(await screen.findByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText(/Inferred from branch, commits and changed files/)).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("shows the API error inline when deriving fails", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json({ error: { code: "intent_model_unavailable", message: "OPENAI_API_KEY is not configured" } }, 400)
        : json({ intent: null, stale: false, model: MODEL }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: /Derive intent/ }));
    expect(await screen.findByText("OPENAI_API_KEY is not configured")).toBeInTheDocument();
  });
});
