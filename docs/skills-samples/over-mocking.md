---
name: over-mocking
description: Flag tests that mock the unit under test, assert only on mock calls, or stub away the behaviour the test claims to verify. Use when a test file in the diff uses vi.mock, jest.mock, spies or hand-written fakes.
type: convention
---

# Over-mocking

Mock at the boundary of the unit, never inside it. A test that replaces the logic
it is supposed to check cannot fail when that logic breaks.

## Our convention

- Mock only what the unit does not own: network (HTTP, GitHub, LLM providers), the
  clock, randomness, the filesystem, and other modules' ports.
- Never mock the module under test, or a private helper of it, from its own test.
- Prefer a real in-memory implementation or a small fake over a chain of
  `mockReturnValueOnce` calls.
- Assert on observable results (return value, response body, DB row, rendered text),
  not on which internal function was called.

## Flag these patterns

1. **Mocking the subject** — `vi.mock('./price-service')` inside
   `price-service.test.ts`, or `vi.spyOn(service, 'calculate').mockReturnValue(42)`
   followed by `expect(service.calculate()).toBe(42)`.
2. **Assert-only-on-mocks** — the only expectations are `toHaveBeenCalled` /
   `toHaveBeenCalledWith`, with no check of the result the user or caller sees.
3. **Mock returns the expected answer** — the mocked dependency returns exactly
   the value the test then asserts, so the code path between them is never checked.
4. **Mocking the data layer to test a query** — a repository test that stubs the DB
   client and asserts the stub was called, instead of running against a real
   (test) database.
5. **Mock drift** — the mock's shape no longer matches the real dependency (renamed
   field, different return type) after this diff changed the real one.
6. **Global mocks without reset** — `vi.mock` / spies that leak between tests
   because there is no `restoreAllMocks` / `resetAllMocks` / `afterEach` cleanup.
7. **Deep mock chains** — `mockReturnValue({ a: { b: { c: vi.fn() } } })` mirroring
   internals; a sign the unit's dependencies should be injected instead.

## Not over-mocking

- Mocking a third-party SDK, the network, timers (`vi.useFakeTimers`) or
  `Math.random` to make a test deterministic.
- React component tests that mock data hooks (`vi.mock` on hooks) and assert on
  rendered output — that is our client convention.
- Interaction assertions when the interaction IS the behaviour (e.g. "sends exactly
  one email", "calls the payment gateway once").

## Severity

- **CRITICAL** — the changed production logic is only "tested" by a test that mocks
  that same logic, so nothing real verifies it, on a money/auth/data path.
- **WARNING** — patterns 1–5 elsewhere.
- **SUGGESTION** — patterns 6–7, or an interaction assertion that could be replaced
  by a result assertion.

## Finding format

Cite the mock line in the test file. In the rationale, name what is mocked and
why it hides the behaviour; in the suggestion, say what to use instead (real
implementation, fake, or which observable result to assert).
