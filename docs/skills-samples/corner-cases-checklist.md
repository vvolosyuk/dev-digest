---
name: corner-cases-checklist
description: Use when reviewing tests for changed functions: check each input against the boundary checklist (zero, negative, empty, null, max, duplicates, unicode, time) and flag the corner cases the tests skip.
type: rubric
---

# Corner-cases checklist

For every function whose behaviour the diff changes, walk its parameters through
the checklist below. Flag a corner case only when the production code has to treat
it specially (or silently mishandles it) AND no test in the diff pins it down.

## Numbers

- `0` — exactly on the boundary of `> 0`, `<= 0`, `>= 0` checks.
- Negative values, including `-1` and the smallest allowed negative.
- The exact boundary on BOTH sides of any comparison (`limit`, `limit - 1`,
  `limit + 1`).
- Non-integers where integers are expected (`0.5`, `1e-9`), `NaN`, `Infinity`.
- Very large values: `Number.MAX_SAFE_INTEGER`, overflow of money in minor units.
- Money / rounding: amounts that do not divide evenly, currency precision.

## Strings

- Empty string `''` and whitespace-only `'  '`.
- Very long input (over any max length the code or schema declares).
- Unicode: emoji, combining characters, RTL text, case-folding (`'İ'.toLowerCase()`).
- Values that look special: `'0'`, `'false'`, `'null'`, leading/trailing spaces.

## Collections

- Empty array / map / set — the zero-iterations path.
- Exactly one element, and the first / last element of a range.
- Duplicates, unsorted input, and input that is already in the target state.
- Pagination: first page, last partial page, page past the end, `limit = 0`.

## Absence

- `null` vs `undefined` vs a missing key — the code often treats them differently.
- Optional fields omitted entirely from a request body.
- Lookups that find nothing (404 path, empty query result).

## Time and order

- Dates on boundaries: midnight, month end, Feb 29, DST switch, time zones.
- Expired vs exactly-at-expiry tokens / TTLs.
- Concurrent or repeated calls: calling twice (idempotency), out-of-order events.

## How to report

- One finding per missing corner case that matters — do not dump the whole
  checklist. Pick the cases the code actually branches on or can break on.
- Cite the production line that handles (or should handle) the case.
- Rationale: the concrete input and what would go wrong or stay unverified.
- Suggestion: the test case to add, with input and expected result.

## Severity

- **WARNING** — a boundary the code explicitly checks (e.g. `amount <= 0`) has no
  test exactly on the boundary (`0`) or just past it (`-1`).
- **SUGGESTION** — a plausible but unlikely input (unicode, huge values) with no test.
- Escalate to **CRITICAL** only when the untested corner case corrupts data, moves
  money, or bypasses a permission check.
