# Findings-by-severity column + hover popup — client

Status: implemented.

See [`server/specs/findings-severity.md`](../../server/specs/findings-severity.md)
for the backend half (aggregation query, data model, shared-contract
approach).

## Context

The server now returns a per-PR `findings_by_severity` breakdown (see the
server spec for how it's computed); this half of the feature displays it in
two places:

1. **Pull Requests list** — a new "Findings" column between Score and Status:
   compact per-severity counters, with a hover popup listing the findings in
   priority order.
2. **PR detail → Agent runs → Timeline** — the same counter block replaces the
   plain "N finding(s)" text, with a matching hover popup.

## Decisions

1. **Timeline (per-run) block = that one run's own non-dismissed findings
   only**, computed client-side from the already-fetched `ReviewRecord[]`
   (`runs` in `FindingsTab.tsx`) keyed by `run_id` — not a new endpoint, and
   not the PR-wide aggregate the list column uses.
2. **Timeline gets the same hover popup as the PR list**, except it must not
   trigger while that run's trace drawer is open (`?trace=<runId>`) — avoids
   two overlays competing for attention.
3. **`ReviewRunAccordion`'s own "N findings · N blockers" text is untouched**
   — deliberately out of scope, not an oversight.
4. **Popup findings are fetched lazily, only on hover** (`usePrReviews(prId, enabled)`),
   not upfront for every PR row — the list itself only carries the lightweight
   per-severity counts (see server spec), keeping the list payload cheap.
5. **The popup renders via `createPortal` into `document.body`** with
   `position: fixed` coordinates computed from the trigger's
   `getBoundingClientRect()` (clamped to the viewport, flips upward near the
   bottom edge, re-clamps on scroll/resize) — required because `position:
   absolute` nested in the PR list row got clipped by the list's `overflow:
   hidden` table card. No vendored Popover/Tooltip primitive exists in
   `client/src/vendor/ui` to reuse instead.
6. Findings inside the popup are sorted by **severity rank first (CRITICAL →
   WARNING → SUGGESTION), then confidence descending** as a tie-break, and
   the rationale is truncated (~110 chars) — neither sort-with-confidence-
   tiebreak nor truncation existed as a reusable helper before this feature.

## Frontend changes

- `client/src/components/SeverityCountBadges/` — new, presentational-only
  component rendering one compact `SeverityBadge` per non-zero severity (or
  `—` when the total is 0); shared by the PR list and the Timeline.
- `client/src/components/FindingsHoverPopover/` — new hover-panel component;
  see Decisions #4–#6 above for its fetch/positioning/sort behavior. Supports
  `loading` (PR-list lazy fetch) and `disabled` (Timeline trace-drawer
  suppression).
- `client/src/lib/hooks/reviews.ts` (`usePrReviews`) — added an `enabled`
  param so the PR list can fetch a PR's findings lazily, only while its
  Findings cell is hovered.
- `client/src/lib/types.ts` — `PrMetaWithFindings` / `FindingsBySeverity`
  local types (replacing the dead, unused `PrRowView` scaffold that had
  speculatively modeled this exact shape).
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
- Dynamic popup positioning beyond viewport clamping/flip (e.g. following the
  trigger if the page itself is resized mid-hover — not observed as an issue,
  not specifically handled beyond the resize/scroll listeners already added).

## Testing strategy (client)

- `SeverityCountBadges.test.tsx` — zero → em-dash, non-zero → correct
  badges/order.
- `FindingsHoverPopover.test.tsx` — sort/truncate helpers, hover open/close
  with fake timers, `disabled` suppression.
- `PRRow.test.tsx` — extended with `findings_by_severity` in its fixture and
  a mock for `usePrReviews`.
- **Manual**: seeded PR #482 (`acme/payments-api`) has 1 CRITICAL + 1 WARNING
  finding — verify the list column, the popup's sort order, dismissed-finding
  exclusion, and (via a real "Run Review") the Timeline block + trace-drawer
  suppression.

## E2E coverage

None. No `e2e/specs/*.flow.json` flow asserts on the new Findings column,
severity badges, or hover popup. `04-pr-findings.flow.json` still passes
unmodified — it only checks the pre-existing, untouched Review Runs
accordion text ("2 findings") and a `FindingCard` title, neither of which
this feature changed.

Adding real coverage is non-trivial with the current flow vocabulary
(`open`/`wait`/`find ... click` — see `e2e/README.md`): the popup is
hover-triggered, and no flow or the underlying `agent-browser` CLI usage in
this repo demonstrates a hover command. Confirming one exists (or working
around it, e.g. by asserting just the always-visible badge counts via `wait
--text` without ever opening the popup) is a prerequisite before adding a
`e2e/specs/08-findings-severity.flow.json`.
