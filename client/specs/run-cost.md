# Run cost tracking — client (L01)

Status: implemented.

See [`server/specs/run-cost.md`](../../server/specs/run-cost.md) for the
backend half (schema, migration, aggregation query, shared-contract changes).

## Context

The server now surfaces a real per-run `cost_usd` (sourced from OpenRouter's
`usage.cost` — see the server spec for how it gets there); this half of the
feature displays it on three screens:

1. **Pull Requests list** — a new Cost column, summed across every run ever
   made on that PR (all agents, all time — a "total spend" figure, not just
   the latest review round).
2. **PR detail → Agent runs tab** — cost shown next to the timestamp in both
   the Timeline (`RunHistory`) and Review Runs (`ReviewRunAccordion`)
   sections.
3. **Run trace drawer → Stats** — a Cost tile alongside Duration / Tokens /
   Findings.

## Decisions

- **Null cost** (no price data for the model, or a still-running run) renders
  as `—`, same convention as `PrMeta`'s existing `score: null` handling. No
  estimate is substituted.
- Reads `RunStats.cost_usd` / `RunSummary.cost_usd` / `PrMeta.cost_usd` as
  `.nullish()` (matches the server's shared-contract change — see server
  spec's Decisions #3) so existing fixtures that omit the field, and old
  persisted `run_traces` JSONB rows from before the column existed, keep
  reading as `undefined`/`null` rather than failing validation.

## Frontend changes

- `client/src/app/repos/[repoId]/pulls/{constants,styles}.ts` +
  `_components/PRRow/PRRow.tsx` — new Cost column between Status and Updated.
- `_components/FindingsTab/FindingsTab.tsx` — builds a `runId → cost_usd` map
  from `prRuns` and passes it into each `ReviewRunAccordion`.
- `_components/RunHistory/RunHistory.tsx` — cost next to the run timestamp.
- `_components/ReviewRunAccordion/ReviewRunAccordion.tsx` — new `cost` prop,
  rendered between the score badge and the timestamp.
- `_components/RunTraceDrawer/_components/TraceBody/TraceBody.tsx` — 4th Stat
  tile.
- `_components/RunTraceDrawer/helpers.ts` — new `formatUsd(cost)` helper
  (handles `null`/`undefined` → `—`), reused by all of the above instead of
  duplicating formatting logic.
- `client/messages/en/prReview.json` (`list.columns.cost`) and
  `client/messages/en/runs.json` (`stat.cost`) — new i18n keys.

## Testing strategy (client)

- Extend `RunTraceDrawer.test.tsx` and `RunHistory.test.tsx` fixtures with
  `cost_usd`.
- Add net-new `PRRow.test.tsx` and `ReviewRunAccordion.test.tsx` (neither
  existed before this feature) covering the cost display + `—` fallback.
- **Manual**: run a real review against PR #482 via a live OpenRouter key and
  confirm cost renders on all three screens — the only step that exercises
  the actual `usage.cost` path end to end, since every automated test above
  uses the mock LLM provider.

## E2E coverage

None. No `e2e/specs/*.flow.json` flow asserts on cost text (`$0.00…`) today —
all seven existing flows predate this feature and none were extended. Adding
coverage would mean asserting a `$`-prefixed cost string renders on the PR
list row and/or the Agent-runs tab against the seeded PR #482 review, which
has no run-level cost seeded (`server/src/db/seed.ts`'s review has no
`run_id`) — seed data would need a cost-bearing `agent_runs` row first.
