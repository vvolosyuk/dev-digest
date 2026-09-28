# ADR-005: Grounding gate is mandatory and mechanical, not model-trusted

**Status:** Accepted

## Context

The reviewer LLM returns structured findings with severities and a
self-reported score. LLMs are known to hallucinate line numbers/locations,
and a finding that points at code that doesn't exist in the diff is worse
than useless — it erodes trust in the whole review.

## Decision

Every finding is mechanically checked against the actual diff by
`groundFindings()` (`reviewer-core/grounding.ts`): a finding that doesn't
cite a line that exists in the diff is dropped, unconditionally. The overall
review score is then recomputed deterministically from the *surviving*
findings only — the model's self-reported score is discarded entirely, never
trusted.

## Alternatives considered

- **Trust the model's self-reported score and findings as-is** — rejected:
  no mechanical guarantee against hallucinated locations or an inflated/
  deflated self-score.
- **Prompt-only mitigation** ("only cite lines that exist") — rejected as
  the sole defense: prompting reduces but does not eliminate hallucination; a
  deterministic post-hoc check is required for the grounding guarantee to
  actually hold.
- **Recover a "close enough" line when the cited one doesn't match** —
  rejected: `reviewer-core/CLAUDE.md` explicitly forbids weakening the gate
  to "recover" a missing finding; a wrong citation must be dropped, not
  patched.

## Consequences

- Some real, valid findings may be dropped if the model cites a line
  slightly wrong (a false negative) — an accepted tradeoff for eliminating
  hallucinated-location false positives.
- Because grounding is deterministic and pure (no LLM call), it's fully
  unit-testable with a stubbed diff/findings pair.
- Any future change to scoring must recompute from grounded findings;
  re-trusting the model's raw score anywhere would silently reopen this gap.
