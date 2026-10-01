# ADR-002: Ban the AI `chat` locator — deterministic locators only

**Status:** Accepted

## Context

agent-browser supports both deterministic commands (`--url`, `--text`, `find
role|text|label`) and an AI-assisted `chat` command that can locate/interact
with elements via natural-language instructions. Using `chat` would make
flows easier to write for fuzzy cases but introduces model non-determinism
into what's meant to be a stable, key-free regression suite.

## Decision

Flows use deterministic locators only. The AI `chat` command is never used,
so runs stay stable and require no API key.

## Alternatives considered

- **Allow `chat` for hard-to-locate elements** — rejected: would reintroduce
  LLM non-determinism and API-key dependency into a suite whose entire value
  proposition (per `e2e/README.md`) is "no LLM, no API key," and would make
  flaky-test triage ambiguous — is the UI broken, or did the model misread
  the page?

## Consequences

- Flow authors must sometimes work harder to find a stable `role`/`text`/
  `label` locator instead of reaching for a natural-language shortcut.
- Every flow failure is attributable to either the app or the flow script —
  never to model variance — which keeps CI signal trustworthy.
- This constraint should be re-examined if agent-browser's deterministic
  locator API proves insufficient for a future, more dynamic UI surface —
  but the default is: don't reach for `chat`.
