---
name: flaky-tests
description: Flag tests whose result depends on timing, wall-clock time, randomness, execution order, shared state or the network. Use when the diff adds or changes test files.
type: rubric
---

# Flaky tests

A flaky test passes and fails on the same code. It erodes trust in CI faster than
a missing test. Flag nondeterminism introduced by the diff and say how to pin it.

> This skill ships with `scripts/detect.sh` as an example of a helper script.
> DevDigest never executes anything from an imported skill — only this `SKILL.md`
> text is read and injected into the prompt. The script is listed as "ignored"
> in the import preview.

## Sources of flakiness to flag

1. **Real sleeps and timeouts** — `setTimeout`, `sleep(…)`, `await new Promise(r =>
   setTimeout(r, 100))` used to "wait until it is done". Use fake timers
   (`vi.useFakeTimers()` + `vi.advanceTimersByTime`) or await the actual event.
2. **Wall-clock time** — `Date.now()`, `new Date()`, `performance.now()` in the code
   under test or in assertions without `vi.setSystemTime(...)`. Breaks at midnight,
   month end, DST, or in another time zone.
3. **Randomness** — `Math.random()`, `crypto.randomUUID()`, random fixtures without a
   fixed seed or injected generator.
4. **Order dependence** — a test that only passes after another test ran first;
   shared module-level state, singletons, or DB rows not reset in
   `beforeEach` / `afterEach`.
5. **Unordered results asserted as ordered** — comparing a DB query or
   `Promise.all` / `Object.keys` result to a fixed array without an `ORDER BY` or a sort.
6. **Real network / external services** — HTTP calls to real hosts, real GitHub or
   LLM APIs, DNS. Mock at the boundary or use a local fake server.
7. **Async without awaiting** — a missing `await` on an assertion
   (`expect(promise).rejects...` without `await`), or `findBy*` / `waitFor` replaced
   by `getBy*` right after an async update.
8. **Tight timing assertions** — `expect(duration).toBeLessThan(50)` on shared CI
   runners.
9. **Ports and files** — hardcoded ports, temp files with fixed names, tests writing
   to the same path in parallel.
10. **Retries hiding flakiness** — newly added `retry: 3` / `test.retry` with no
    explanation.

## How to report

- Cite the exact test line that introduces the nondeterminism.
- Rationale: the source (from the list above) and the condition under which the test
  fails (slow CI, different TZ, parallel run).
- Suggestion: the deterministic replacement (fake timers, `setSystemTime`, seeded
  generator, explicit sort, reset hook).

## Severity

- **WARNING** — any of sources 1–7 added by this diff.
- **SUGGESTION** — sources 8–10, or a minor determinism improvement.
- Never **CRITICAL**: a flaky test does not break production by itself.
