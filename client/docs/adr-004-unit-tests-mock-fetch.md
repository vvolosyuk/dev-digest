# ADR-004: Unit tests mock fetch; real-network coverage lives in e2e

**Status:** Accepted

## Context

The studio needs fast, deterministic component/interaction tests that don't
require Postgres, the Fastify API, or a browser — but also needs confidence
that the UI works against the real API end to end.

## Decision

`client/`'s vitest + jsdom suite mocks `fetch` (no MSW, no real network),
testing hooks/components/interaction logic in isolation. Real-network,
real-browser coverage — client + API + seeded DB — is deliberately pushed
entirely to the separate `e2e/` package (agent-browser flows against a real
running stack).

## Alternatives considered

- **Mock Service Worker (MSW)** for more realistic network-layer mocking —
  not adopted; plain `fetch` mocking was judged sufficient given the thin
  `api.ts` boundary ([ADR-001](adr-001-data-fetching-via-hooks.md)) and
  avoids an extra dependency/setup for the course starter.
- **Run client unit tests against a real API instance** — rejected: would
  require Postgres + Fastify in every test run, defeating the "fast, no
  Docker" goal of the `client.yml` CI workflow (see `../../TESTING.md`).

## Consequences

- `client` CI (`client.yml`) needs no Docker and runs fast.
- A regression only visible when the real API's response shape changes won't
  be caught by unit tests — that gap is intentionally covered by `e2e/`
  instead (see `../../e2e/docs/adr-005-read-only-seeded-flows.md`).
- Test authors must keep `fetch` mocks in sync with the actual Zod response
  contracts by hand; nothing enforces this automatically at the unit-test
  layer.
