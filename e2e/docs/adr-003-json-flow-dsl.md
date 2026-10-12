# ADR-003: Flows are declarative JSON commands, not a Playwright/Vitest-style framework

**Status:** Accepted

## Context

agent-browser is a CLI, not a test framework — it has no built-in notion of
a "test file," assertions, or a runner. Something has to define what a
"flow," a "step," and a "pass/fail" mean, and give flows a stable
numbering/ordering convention.

## Decision

Each flow is a JSON file (`specs/NN-name.flow.json`) — a list of `{ cmd,
label }` steps passed verbatim to `agent-browser`, executed in order against
one shared browser session by a thin custom runner (`run.ts`). A non-zero
exit from any step fails the step and the flow, so `wait --text`/`wait
--url` steps double as assertions (they time out and exit non-zero if the
condition never holds). An optional `assert.stdoutIncludes` adds a substring
check.

## Alternatives considered

- **Wrap agent-browser calls inside Playwright Test or Vitest** as the
  runner/assertion framework — rejected: would pull in a full test
  framework's dependency surface and conceptual model (fixtures, `expect`,
  parallel workers) for what's fundamentally "run this list of CLI commands
  in order," which agent-browser + a thin runner already accomplishes.
- **Write flows as TypeScript functions calling agent-browser directly** —
  rejected: JSON keeps flows declarative and easy to scan/diff, and keeps the
  "spec IS the flow definition" property called out in `e2e/AGENTS.md` (no
  separate planning doc, no test-framework boilerplate per flow).

## Consequences

- Adding a flow means adding one JSON file with a zero-padded, never-reused
  numeric prefix (`e2e/AGENTS.md` naming convention) — no test-framework
  ceremony.
- No access to a mature test framework's reporting/parallelism/retry
  features; `run.ts` owns all of that, so any gap there is the team's own
  thin layer to maintain, not inherited tooling.
- Assertions are limited to what agent-browser's exit codes and
  `stdoutIncludes` can express — there's no rich matcher library.
