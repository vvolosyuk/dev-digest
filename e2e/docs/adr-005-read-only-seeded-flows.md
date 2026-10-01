# ADR-005: Flows only exercise read-only seeded data — never trigger an LLM call

**Status:** Accepted

## Context

A browser e2e suite could, in principle, exercise "click Review → wait for
AI findings" end to end. But that would make every e2e run depend on an LLM
API key, incur real cost, and introduce model-output non-determinism into a
suite whose whole point (per `e2e/README.md`) is deterministic, key-free CI
runs.

## Decision

All flows target read-only seeded data — the demo repo `acme/payments-api`,
PR #482, and the two seeded agents — that already has a pre-seeded run/
findings in the database (flow `04-pr-findings` asserts against the
*seeded* run verdict and findings; it does not trigger a new review).
Nothing in the e2e suite clicks "Run review" against a live model.

## Alternatives considered

- **Trigger a real review run as part of an e2e flow** — rejected: would
  require an LLM API key in CI, add real per-run cost, and make flow
  assertions depend on non-deterministic model output — exactly what the
  grounding gate and `INJECTION_GUARD` in `server/` exist to manage, not
  what a UI smoke test should also have to tolerate.
- **Mock the LLM at the API layer during e2e** (real browser, stubbed
  model) — not adopted for the starter; would require e2e-specific server
  configuration/mocking hooks that don't otherwise exist, adding complexity
  for a suite meant to stay thin.

## Consequences

- e2e can run in CI with zero API keys and zero LLM spend, and is fully
  deterministic (see [ADR-002](adr-002-deterministic-locators-only.md)).
- e2e cannot catch regressions in the actual "run a review" model-calling
  path — that's covered by `reviewer-core`'s hermetic unit tests (stubbed
  `LLMProvider`) and `server-integration.yml`, not by browser e2e. A reader
  looking for "where is the review flow itself tested end-to-end with a real
  model" should look there, not here.
