# Findings-by-severity column + hover popup

Status: implemented.

## Context

The Pull Requests list showed a Score ring and a Status badge but no
breakdown of *what* is wrong with a PR — reviewers had to open the PR detail
page to see how many CRITICAL/WARNING/SUGGESTION findings exist. This adds a
"Findings" column (compact per-severity counters) to the PR list between
Score and Status, a hover popup listing those findings in priority order, and
mirrors the same counter block in the PR detail page's Agent-runs Timeline
(replacing its plain "N finding(s)" text), with a matching hover popup there
too (suppressed while that run's trace drawer is open). This was deferred out
of the run-cost feature (see `run-cost.md`'s "Out of scope") as an unrelated
gap; this spec closes it.

## Decisions

1. **PR-list Findings badge/popup = all non-dismissed findings across every
   review ever run on the PR** (every agent, every re-run — not just the
   latest review round, unlike the Score column). A PR reviewed by 3 agents
   shows the combined outstanding backlog, not one agent's last output.
2. **Timeline (per-run) block = that one run's own non-dismissed findings
   only**, not the PR-wide aggregate — matches the existing per-run scoping of
   `blockers`/`findings_count` on `RunSummary`.
3. **Timeline gets the same hover popup as the PR list**, except it must not
   trigger while that run's trace drawer is open (`?trace=<runId>`) — avoids
   two overlays competing for attention.
4. **`ReviewRunAccordion`'s own "N findings · N blockers" text is untouched**
   — deliberately out of scope, not an oversight.
5. **Blockers stays untouched everywhere** — still the persisted, gate-aware
   `RunSummary.blockers` / `countBlockers()` from `reviewer-core`; this
   feature only adds the per-severity breakdown alongside it.
6. **No vendor edits.** `server/src/vendor/shared`, `client/src/vendor/shared`,
   and `client/src/vendor/ui` are "do not touch" per `CLAUDE.md`. This is
   possible because `GET /repos/:id/pulls` declares no Fastify response
   schema — its handler's return type is a plain TS annotation, not a
   runtime-validated/stripped Zod shape — so the new field is added via a
   locally-defined intersection type (`PrMetaWithFindings`) instead of
   extending the vendored `PrMeta` contract. Vendored primitives
   (`SeverityBadge`, `CategoryTag`, `ConfidenceNum`, `tokens.ts`'s `SEV` map)
   are only imported/composed, never edited.
7. **No DB migration.** The severity breakdown is computed live on read (same
   pattern as `score`/`cost_usd`), not denormalized onto a new column —
   reuses the already-unit-tested `rollupSeverities()` helper from
   `server/src/modules/pulls/status.ts`.

## Data model

No schema changes. `findings.severity` and `findings.dismissed_at` (existing
columns) are aggregated at read time, grouped by `prId` in JS after a single
query joining `findings` → `reviews` (filtered to `kind = 'review'` and
`dismissed_at IS NULL`).

## Shared contracts

None touched. `findings_by_severity: Record<'CRITICAL'|'WARNING'|'SUGGESTION', number>`
is added locally on both sides instead of on the vendored `PrMeta`/`RunSummary`
contracts:
- Server: `PrMetaWithFindings = PrMeta & { findings_by_severity: ... }` in
  `server/src/modules/pulls/routes.ts`.
- Client: `PrMetaWithFindings` and the `FindingsBySeverity` alias in
  `client/src/lib/types.ts` (replacing the dead, unused `PrRowView` scaffold
  that had speculatively modeled this exact shape).

## Backend changes

- `server/src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`) — new
  aggregation block (alongside the existing `latestReviewByPr`/`costByPr`
  blocks): fetches `{prId, severity}` rows for non-dismissed findings on
  `kind='review'` reviews for the listed PRs, groups by `prId` in JS, tallies
  each group via `rollupSeverities()`, defaults every PR to
  `{CRITICAL:0,WARNING:0,SUGGESTION:0}`, and adds `findings_by_severity` to
  the response.

## Frontend changes

- `client/src/components/SeverityCountBadges/` — new, presentational-only
  component rendering one compact `SeverityBadge` per non-zero severity (or
  `—` when the total is 0); shared by the PR list and the Timeline.
- `client/src/components/FindingsHoverPopover/` — new hover-panel component
  (no vendored Popover/Tooltip primitive exists) wrapping a trigger, showing a
  sorted (severity, then confidence desc) findings list with a ~150ms
  mouse-leave close delay; supports `loading` (PR-list lazy fetch) and
  `disabled` (Timeline trace-drawer suppression). The panel (440px wide) is
  rendered via a `createPortal` into `document.body` with `position: fixed`
  coordinates computed from the trigger's `getBoundingClientRect()` — this is
  what lets it escape the PR list table card's `overflow: hidden` (it was
  getting clipped when positioned `absolute` inside that container). Position
  is clamped to the viewport's left/right edges and flips to open upward when
  there isn't enough room below, and re-clamps on scroll/resize while open.
- `client/src/lib/hooks/reviews.ts` (`usePrReviews`) — added an `enabled`
  param so the PR list can fetch a PR's findings lazily, only while its
  Findings cell is hovered.
- `client/src/app/repos/[repoId]/pulls/{constants,styles}.ts` +
  `_components/PRRow/PRRow.tsx` — new Findings column between Score and
  Status.
- `_components/FindingsTab/FindingsTab.tsx` — builds per-run
  `findingsCountByRunId`/`findingsListByRunId` maps from the already-fetched
  `runs` (`ReviewRecord[]`), mirroring the existing `costByRunId` pattern;
  threads `traceRunId` down from `page.tsx`.
- `_components/RunHistory/RunHistory.tsx` — Timeline row's plain
  "{N} finding(s)" text replaced with `SeverityCountBadges` +
  `FindingsHoverPopover`; the " · {N} blockers" text right after is unchanged.
- `client/messages/en/prReview.json` — `list.columns.findings` and a new
  `findingsPopover.{total,loading,empty}` block.

## Out of scope

- `ReviewRunAccordion.tsx`'s own "N findings · N blockers" text.
- Any vendor directory.
- A DB migration / denormalized column for the severity breakdown.

## Testing strategy

- **server-unit**: `rollupSeverities()` already covered by
  `server/test/pulls-status.test.ts`.
- **server-integration** (`integration.it.test.ts`, needs Docker): new case
  asserting `GET /repos/:id/pulls`'s `findings_by_severity` excludes dismissed
  findings and defaults to an all-zero object for PRs with none.
- **client**: `SeverityCountBadges.test.tsx` (zero → em-dash, non-zero →
  correct badges/order); `FindingsHoverPopover.test.tsx` (sort/truncate
  helpers, hover open/close with fake timers, `disabled` suppression);
  `PRRow.test.tsx` extended with `findings_by_severity` in its fixture and a
  mock for `usePrReviews`.
- **Manual**: seeded PR #482 (`acme/payments-api`) has 1 CRITICAL + 1 WARNING
  finding — verify the list column, the popup's sort order, dismissed-finding
  exclusion, and (via a real "Run Review") the Timeline block + trace-drawer
  suppression.
