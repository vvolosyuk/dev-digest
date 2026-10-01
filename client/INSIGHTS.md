# client insights

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-09-17 — Component tests don't mock global `fetch` despite `AGENTS.md` saying "fetch mocked"; they `vi.mock()` the specific data hook module by relative path instead. Mock the hook, not `fetch`, when writing a new component test. (`client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.test.tsx:9`)
- 2026-09-20 — `client/src/vendor/shared` and `server/src/vendor/shared` are NOT identical mirrors of `@devdigest/shared` — client's copy is a trimmed subset (confirmed via diff: missing CI/GitHubClient-only types like `commitFiles`/`sync`/`diffNameOnly`). There's no sync tooling in-repo, so any shared-contract field consumed by both packages must be hand-added to both `contracts/*.ts` copies identically. (`client/src/vendor/shared/contracts/trace.ts`, `server/src/vendor/shared/contracts/trace.ts`)
- 2026-09-20 — New fields on `RunStats`/`RunSummary`/`PrMeta` (`vendor/shared/contracts/trace.ts`, `platform.ts`) must be `z.number().nullish()`, not `.nullable()`. `.nullable()` requires the key present, which breaks existing fixtures that omit it (`server/test/contracts.test.ts`'s `RunTrace.parse()`, `RunTraceDrawer.test.tsx`'s `TRACE`) and breaks reading old persisted `run_traces` JSONB rows from before the field existed — `getRunTrace()` casts without re-validating, so a missing key silently becomes `undefined`, not `null`.

## Tool & Library Notes

- 2026-09-28 — `client/src/vendor/ui` has no Popover/Tooltip/HoverCard primitive at all (confirmed via exhaustive grep across the whole vendor/ui tree). The closest existing thing is `kit/Dropdown.tsx`, which is click-triggered (not hover) and itself vendored (do-not-touch). When you need a hover panel, build it as a new local component — see `client/src/components/FindingsHoverPopover/FindingsHoverPopover.tsx` for a working hover-panel pattern (mouseenter/leave with a close-delay timer, portal-rendered — see Recurring Errors & Fixes below).
- 2026-09-28 — Glob/file-search patterns over paths containing Next.js App Router's bracketed dynamic segments (`[repoId]`, `[number]`) can silently return zero matches — the brackets get parsed as glob character classes, not literal directory names. An empty Glob result under `pulls/[number]/...` or `pulls/[repoId]/...` is not proof a file doesn't exist — verify with `ls`/Bash (or an unambiguous non-glob path check) before concluding a file is missing. This produced a false "no test file exists for RunHistory.tsx" conclusion when `RunHistory.test.tsx` was present the whole time.

## Recurring Errors & Fixes

- 2026-09-21 — A per-PR aggregate shown on the Pull Requests list (Score ring, Cost column — anything sourced from `usePulls(repoId)`) goes stale forever after a review run and stays wrong no matter how many follow-up runs complete: `onRunDone` in `pulls/[number]/page.tsx` (~line 156) invalidated `pr-active-runs`/`pr-runs`/`reviews` but never `["pulls", repoId]`. Fixed by adding that invalidation to `onRunDone`. Any future PR-list column computed server-side from run/review data needs this same query key invalidated on run completion — it's not automatic. (`client/src/app/repos/[repoId]/pulls/[number]/page.tsx:156`)
- 2026-09-28 — When you build an absolutely-positioned overlay (hover panel, tooltip, popover) that might render inside a container with `overflow: hidden` — e.g. the PR list's `s.tableCard` (`client/src/app/repos/[repoId]/pulls/styles.ts:95`) — it gets visually clipped at the container's edge regardless of z-index; `position: absolute` nested in normal DOM flow isn't enough. Fix: render the overlay via `createPortal(node, document.body)` with `position: fixed` coordinates computed from the trigger's `getBoundingClientRect()` (clamp to viewport edges, flip upward near the bottom edge). Working example + the clamping/flip math: `client/src/components/FindingsHoverPopover/FindingsHoverPopover.tsx` (`computePanelPos`).

## Session Notes

- 2026-09-17: Verified engineering-insights skill against a checklist (items 8-11): confirmed component-test fetch-mocking pattern (see Codebase Patterns) as a real test case for module-scoped writes.
- 2026-09-20/21: Added run cost tracking to the PR list, PR timeline, and run trace drawer (L01 lesson; spec at `server/specs/run-cost.md`). Found + fixed a stale-cache bug the next session where the PR list's Score/Cost never updated after a run (see Recurring Errors & Fixes) — this class of bug (a new aggregate column silently not wired into existing invalidation) is worth checking for proactively whenever a PR-list column is added, not just discovered via user report.
- 2026-09-28: Added the PR list's Findings column (severity badges + hover popup) and mirrored it in the PR detail Timeline (spec at `server/specs/findings-severity.md`). New components: `SeverityCountBadges` and `FindingsHoverPopover` (`client/src/components/`). Confirmed no vendor edits were needed (`PrMetaWithFindings`/`FindingsBySeverity` added as local types in `client/src/lib/types.ts` instead — see server/INSIGHTS.md for why that route allows it). Two follow-up fixes after initial ship: widened the popup (360px→440px) and switched it to portal+fixed positioning to stop it being clipped by the PR list's `overflow:hidden` table card (see Recurring Errors & Fixes).

## Open Questions
