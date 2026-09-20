# client insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-09-17 — Component tests don't mock global `fetch` despite `CLAUDE.md` saying "fetch mocked"; they `vi.mock()` the specific data hook module by relative path instead. Mock the hook, not `fetch`, when writing a new component test. (`client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.test.tsx:9`)
- 2026-09-20 — `client/src/vendor/shared` and `server/src/vendor/shared` are NOT identical mirrors of `@devdigest/shared` — client's copy is a trimmed subset (confirmed via diff: missing CI/GitHubClient-only types like `commitFiles`/`sync`/`diffNameOnly`). There's no sync tooling in-repo, so any shared-contract field consumed by both packages must be hand-added to both `contracts/*.ts` copies identically. (`client/src/vendor/shared/contracts/trace.ts`, `server/src/vendor/shared/contracts/trace.ts`)
- 2026-09-20 — New fields on `RunStats`/`RunSummary`/`PrMeta` (`vendor/shared/contracts/trace.ts`, `platform.ts`) must be `z.number().nullish()`, not `.nullable()`. `.nullable()` requires the key present, which breaks existing fixtures that omit it (`server/test/contracts.test.ts`'s `RunTrace.parse()`, `RunTraceDrawer.test.tsx`'s `TRACE`) and breaks reading old persisted `run_traces` JSONB rows from before the field existed — `getRunTrace()` casts without re-validating, so a missing key silently becomes `undefined`, not `null`.

## Tool & Library Notes

## Recurring Errors & Fixes

- 2026-09-21 — A per-PR aggregate shown on the Pull Requests list (Score ring, Cost column — anything sourced from `usePulls(repoId)`) goes stale forever after a review run and stays wrong no matter how many follow-up runs complete: `onRunDone` in `pulls/[number]/page.tsx` (~line 156) invalidated `pr-active-runs`/`pr-runs`/`reviews` but never `["pulls", repoId]`. Fixed by adding that invalidation to `onRunDone`. Any future PR-list column computed server-side from run/review data needs this same query key invalidated on run completion — it's not automatic. (`client/src/app/repos/[repoId]/pulls/[number]/page.tsx:156`)

## Session Notes

- 2026-09-17: Verified engineering-insights skill against a checklist (items 8-11): confirmed component-test fetch-mocking pattern (see Codebase Patterns) as a real test case for module-scoped writes.
- 2026-09-20/21: Added run cost tracking to the PR list, PR timeline, and run trace drawer (L01 lesson; spec at `server/specs/run-cost.md`). Found + fixed a stale-cache bug the next session where the PR list's Score/Cost never updated after a run (see Recurring Errors & Fixes) — this class of bug (a new aggregate column silently not wired into existing invalidation) is worth checking for proactively whenever a PR-list column is added, not just discovered via user report.

## Open Questions
