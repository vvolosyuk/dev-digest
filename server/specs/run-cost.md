# Run cost tracking — server (L01)

Status: implemented.

See [`client/specs/run-cost.md`](../../client/specs/run-cost.md) for the
frontend half of this feature (how cost is displayed, formatted, and tested
on the three screens listed below).

## Context

`reviewer-core`'s `reviewPullRequest()` already computes `ReviewOutcome.costUsd`
(summed across every LLM call in a run, sourced from OpenRouter's reported
`usage.cost`), but the server dropped it — `run-executor.ts` never persisted
or surfaced it. This spec adds the backend plumbing to get cost from that
computed-but-discarded value through to the API, for three consuming screens:
the Pull Requests list's Cost column, the PR detail Agent-runs tab (Timeline +
Review Runs), and the run trace drawer's Stats tile.

Cost data is sourced from **OpenRouter only** for now (the only provider that
returns a real per-call cost). No static price-table fallback is added for
OpenAI/Anthropic in this pass.

## Decisions

1. **PR-list cost = `SUM(agent_runs.cost_usd)` grouped by `prId`**, not the
   latest-review-only pattern the Score column uses — multiple agents can
   review one PR, and we want total spend, not one agent's last number.
2. **Failed/cancelled runs get `cost_usd: 0`**, matching the existing
   `tokensIn: 0, tokensOut: 0` zeroing on the failure path (`run-executor.ts`'s
   catch block never has partial per-chunk state to report — a pre-existing
   limitation this feature doesn't change).
3. **Shared zod fields are `.nullish()`, not `.nullable()`** — required to keep
   `server/test/contracts.test.ts`'s `RunTrace.parse()` fixture and the
   client's `RunTraceDrawer.test.tsx` `TRACE` fixture (both omit `cost_usd`)
   passing/type-checking unmodified, and to gracefully read old `run_traces`
   JSONB rows persisted before this column existed.

(The "null cost renders as `—`" decision is a display concern — see
`client/specs/run-cost.md`.)

## Data model

`agent_runs.cost_usd double precision` (nullable) — new column, mirrors the
`costUsd: doublePrecision('cost_usd')` pattern already used in
`server/src/db/schema/eval.ts`. Migration via `pnpm db:generate` (never
hand-authored).

`reviews` table is **not** touched — cost stays owned by `agent_runs`; the
Review Runs UI cross-references it via `reviews.run_id`.

## Shared contracts (`@devdigest/shared`, vendored in both `server/src/vendor/shared`
and `client/src/vendor/shared` — edited identically in both, no sync tooling exists)

- `contracts/trace.ts`: `RunStats.cost_usd` and `RunSummary.cost_usd` →
  `z.number().nullish()`.
- `contracts/platform.ts`: `PrMeta.cost_usd` → `z.number().nullish()`.

## Backend changes

- `server/src/db/schema/runs.ts` — add the column.
- `server/src/modules/reviews/run-executor.ts` — stop dropping `costUsd` from
  the destructured `outcome`; pass it into `completeAgentRun()` and into
  `RunTrace.stats.cost_usd`; zero it in the failure/`traceFromBuffer` paths.
- `server/src/modules/reviews/repository/run.repo.ts` — `completeAgentRun()`
  writes `cost_usd`; `listRunsForPull()` maps it into `RunSummary`.
- `server/src/modules/pulls/routes.ts` — new grouped `SUM(agent_runs.cost_usd)`
  query (alongside the existing `latestReviewByPr` score query), mapped into
  each returned PR as `cost_usd`.

## Out of scope

- The mockups' `FINDINGS` column on the PR list — implemented separately, see
  `server/specs/findings-severity.md` / `client/specs/findings-severity.md`.
- OpenAI/Anthropic real-cost sourcing — both currently use a static price
  table (`server/src/adapters/llm/pricing.ts`); no change here.
- Partial-cost recovery on a mid-run failure — matches existing token
  behavior, not newly introduced or fixed by this feature.

## Testing strategy (server)

- **server-unit**: `contracts.test.ts` needs no edit (nullish fields keep
  existing fixtures valid); `price-book.test.ts` unaffected.
- **server-integration** (`*.it.test.ts`, needs Docker):
  - `reviews.it.test.ts` — extend the map-reduce/grounding test with
    `agent_runs.cost_usd` + `trace.stats.cost_usd` assertions using
    `MockLLMProvider`'s fixed `costUsd: 0.001`; add a multi-agent case; add a
    failed-run case asserting `cost_usd === 0`.
  - `integration.it.test.ts` — new coverage for the PR-list `SUM(...) GROUP BY
    prId` query (no existing test touches this route's aggregation today —
    still an open gap, see `INSIGHTS.md`).

For frontend and e2e test coverage, see `client/specs/run-cost.md`.
