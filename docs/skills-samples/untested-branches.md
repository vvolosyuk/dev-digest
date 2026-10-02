---
name: untested-branches
description: Flag every branch, guard clause, early return and thrown error added or changed in the diff that no test in the same diff exercises. Use when the PR changes production logic together with (or without) tests.
type: rubric
---

# Untested branches

Map each changed decision point in production code to a test that drives it. A
branch with no test is an untested behaviour, however simple it looks.

## How to apply

1. List every decision point the diff ADDS or CHANGES in non-test files:
   - `if` / `else if` / `else`, `switch` cases (including `default`), ternaries;
   - guard clauses and early `return`s;
   - `throw` statements and `catch` blocks;
   - short-circuits that change behaviour (`a ?? b`, `a || b`, `a && f()`, `?.`);
   - loops whose body is skipped for empty input (the zero-iterations path).
2. For each one, look in the diff's test files for a test whose input makes that
   specific path run AND whose assertion checks that path's outcome.
3. A path is **covered** only when both hold. A test that runs through the
   function on the happy path does NOT cover the `throw` above it.

## What counts as a gap

- A new `throw` / rejected promise with no test asserting it (`toThrow`,
  `rejects.toThrow`, an error status code for a route).
- An `else` / `default` branch with no test, while the `if` / named cases have one.
- A `catch` block with no test that makes the `try` fail.
- A newly added guard (`if (!user) return 404`) with no test for the guarded case.
- A changed condition (`>` became `>=`) where no test sits exactly on the boundary.

## What is NOT a gap

- Pure type guards that TypeScript already makes unreachable.
- Logging-only branches with no observable behaviour.
- Branches already covered by tests outside the diff that are clearly visible in the
  provided context — say so instead of flagging.

## Severity

- **CRITICAL** — the untested branch protects money, auth/permissions, data writes
  or deletion, or a public contract (e.g. an input-validation `throw` on a
  payment amount), AND the diff ships no test for it.
- **WARNING** — any other untested branch introduced by the diff.
- **SUGGESTION** — the branch is tested but the assertion is weak (only checks
  that "something" was thrown, not which error).

## Finding format

- Cite the production line of the untested branch (not the test file).
- Rationale: name the branch and the input that would take it, e.g.
  "`amount <= 0` throws, but the only test calls `charge(100)`".
- Suggestion: the exact test to add — input and expected outcome, e.g.
  "`expect(() => charge(0)).toThrow(InvalidAmountError)`".
