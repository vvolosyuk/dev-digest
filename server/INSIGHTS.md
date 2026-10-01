# server insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-09-20 — Per-PR aggregation across multiple agent runs (e.g. summing cost) should query `agent_runs` directly (it has a nullable `prId` FK) rather than mirroring the "latest row wins" pattern `pulls/routes.ts`'s existing Score column uses over `reviews`. The `reviews` table has no duration/tokens/cost columns at all — those live only on `agent_runs`, joined to a review via `reviews.runId` (no FK constraint, just a plain uuid column). (`server/src/modules/pulls/routes.ts`, `server/src/modules/reviews/repository/run.repo.ts`)
- 2026-09-28 — When you need to add a field to a GET response and CLAUDE.md's "do not touch `server/src/vendor/shared`" blocks extending the obvious Zod contract, check whether that specific `app.get(...)` registration even declares a `schema: { response: ... }` block first. `GET /repos/:id/pulls` (`server/src/modules/pulls/routes.ts:33`, no response schema — only `schema: { params: IdParams }`) has no runtime serialization stripping extra keys, so a locally-defined intersection type (`PrMetaWithFindings = PrMeta & {...}`, same file, line ~15) is enough — no vendor edit, no `.extend()` on the imported schema needed. This only works because THIS route has no response schema; don't assume it generalizes to routes that do declare one.

## Tool & Library Notes

## Recurring Errors & Fixes

- 2026-09-20 — `ReviewRunExecutor`'s `completeAgentRun()` values shape is duplicated in three places, not one: the real implementation in `repository/run.repo.ts`, a thin re-export wrapper in `repository.ts` that re-declares its own inline copy of the same type, and every call site in `run-executor.ts` (the success path, the per-agent failure `catch` block, AND the separate pre-work `failAll` loop used when diff-loading fails before any agent runs). Adding a required field to that values object surfaces as three separate `tsc` errors, one file at a time — grep all three before considering the change done. (`server/src/modules/reviews/repository.ts:151`, `repository/run.repo.ts:141`, `run-executor.ts:78,243,300`)

## Session Notes

- 2026-09-20/21: Added run cost tracking end-to-end — `agent_runs.cost_usd` column + migration, PR-list `SUM(...) GROUP BY prId`, and the run trace `stats.cost_usd` — spec at `server/specs/run-cost.md`. `reviewer-core`'s `reviewPullRequest()` already computed per-run `costUsd` (from OpenRouter's `usage.cost`); the server was silently discarding it — `run-executor.ts` destructured it out of the outcome and never persisted or forwarded it. Worth checking `ReviewOutcome`/`StructuredResult`'s full shape in `reviewer-core` for other computed-but-unplumbed fields before assuming a "new" feature needs new computation, not just new wiring.
- 2026-09-28: Added the PR list's Findings column + per-run Timeline severity block (`server/specs/findings-severity.md`) — this was the exact gap `run-cost.md`'s "Out of scope" section had deferred. `findings_by_severity` is computed live (no migration) by grouping `findings` joined to `reviews` by `prId` in JS and tallying via the already-existing, already-unit-tested `rollupSeverities()` (`server/src/modules/pulls/status.ts`), which was defined but never wired into the route before this session.

## Open Questions

- 2026-09-20 — No test covers `GET /repos/:id/pulls`'s per-PR aggregation logic (the Score/Cost grouping in `pulls/routes.ts`) — only PR import/idempotency is exercised in `integration.it.test.ts`. A regression here (e.g. a join fanning out rows and inflating a `SUM`) wouldn't be caught by CI today.
- 2026-09-28 — The line above is now only half-true: the new `findings_by_severity` aggregation added in this same handler DOES have integration coverage (`server/test/integration.it.test.ts`, "tallies findings_by_severity per PR, excluding dismissed"). The Score/Cost aggregation blocks (`pulls/routes.ts` lines ~121-153) are still untested.
