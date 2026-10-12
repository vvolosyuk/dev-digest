# Findings-by-severity column + hover popup — server

Status: implemented.

See [`client/specs/findings-severity.md`](../../client/specs/findings-severity.md)
for the frontend half of this feature (components, popup behavior, UI
testing, e2e coverage).

## Context

The Pull Requests list showed a Score ring and a Status badge but no
breakdown of *what* is wrong with a PR — reviewers had to open the PR detail
page to see how many CRITICAL/WARNING/SUGGESTION findings exist. This spec
adds the backend aggregation a new "Findings" column (and its hover popup)
needs. This was deferred out of the run-cost feature (see
`server/specs/run-cost.md`'s "Out of scope") as an unrelated gap; this spec
closes it.

## Decisions

1. **PR-list Findings badge/popup = all non-dismissed findings across every
   review ever run on the PR** (every agent, every re-run — not just the
   latest review round, unlike the Score column). A PR reviewed by 3 agents
   shows the combined outstanding backlog, not one agent's last output.
2. **Timeline (per-run) block = that one run's own non-dismissed findings
   only**, not the PR-wide aggregate — matches the existing per-run scoping of
   `blockers`/`findings_count` on `RunSummary`. (Computed client-side — see
   client spec.)
3. **Blockers stays untouched everywhere** — still the persisted, gate-aware
   `RunSummary.blockers` / `countBlockers()` from `reviewer-core`; this
   feature only adds the per-severity breakdown alongside it.
4. **No vendor edits.** `server/src/vendor/shared` and `client/src/vendor/shared`
   are "do not touch" per `AGENTS.md`. This is possible because
   `GET /repos/:id/pulls` declares no Fastify response schema — its handler's
   return type is a plain TS annotation, not a runtime-validated/stripped Zod
   shape — so the new field is added via a locally-defined intersection type
   (`PrMetaWithFindings`) instead of extending the vendored `PrMeta` contract.
5. **No DB migration.** The severity breakdown is computed live on read (same
   pattern as `score`/`cost_usd`), not denormalized onto a new column —
   reuses the already-unit-tested `rollupSeverities()` helper from
   `server/src/modules/pulls/status.ts`.

(Decision about the Timeline's hover popup being suppressed while the run's
trace drawer is open, and `ReviewRunAccordion` being left untouched, are
frontend-only — see the client spec.)

## Data model

No schema changes. `findings.severity` and `findings.dismissed_at` (existing
columns) are aggregated at read time, grouped by `prId` in JS after a single
query joining `findings` → `reviews` (filtered to `kind = 'review'` and
`dismissed_at IS NULL`).

## Shared contracts

None touched. `findings_by_severity: Record<'CRITICAL'|'WARNING'|'SUGGESTION', number>`
is added locally on both sides instead of on the vendored `PrMeta`/`RunSummary`
contracts — server: `PrMetaWithFindings = PrMeta & { findings_by_severity: ... }`
in `server/src/modules/pulls/routes.ts`. (Client-side counterpart: see client
spec.)

## Backend changes

- `server/src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`) — new
  aggregation block (alongside the existing `latestReviewByPr`/`costByPr`
  blocks): fetches `{prId, severity}` rows for non-dismissed findings on
  `kind='review'` reviews for the listed PRs, groups by `prId` in JS, tallies
  each group via `rollupSeverities()`, defaults every PR to
  `{CRITICAL:0,WARNING:0,SUGGESTION:0}`, and adds `findings_by_severity` to
  the response.

## Out of scope

- Any vendor directory.
- A DB migration / denormalized column for the severity breakdown.

(Frontend-side out-of-scope items — e.g. `ReviewRunAccordion`'s text being
left untouched — are in the client spec.)

## Testing strategy (server)

- **server-unit**: `rollupSeverities()` already covered by
  `server/test/pulls-status.test.ts`.
- **server-integration** (`integration.it.test.ts`, needs Docker): new case
  asserting `GET /repos/:id/pulls`'s `findings_by_severity` excludes dismissed
  findings and defaults to an all-zero object for PRs with none.

For frontend and e2e test coverage, see `client/specs/findings-severity.md`.
