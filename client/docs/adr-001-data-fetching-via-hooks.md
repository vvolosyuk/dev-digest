# ADR-001: Fetch data only through TanStack Query hooks

**Status:** Accepted

## Context

The studio UI needs consistent loading/error/cache state across many routes
(PR list, PR detail, agents, settings) that all hit the same Fastify API.
Without a convention, components could each call `fetch` inline, leading to
duplicated loading logic, inconsistent caching, and no single place to adjust
the API base URL or error handling.

## Decision

Every piece of server data flows through a colocated hook in
`src/lib/hooks/*` (one hook file per resource, e.g. `useRepos`), which itself
calls `src/lib/api.ts`. Components never call `fetch` directly, and Server
Components don't reach into Postgres directly — `client/` has no DB
awareness at all. All data comes from the Fastify API via these hooks.

## Alternatives considered

- **Fetch directly in components/Server Components** — rejected: scatters
  loading/error handling across the codebase and removes the single mocking
  boundary unit tests rely on (see [ADR-004](adr-004-unit-tests-mock-fetch.md)).
- **Next.js Server Actions calling the DB directly** — rejected: would give
  `client/` direct DB awareness, breaking the independence between `client/`
  and `server/` that lets each package be built/tested/deployed on its own.
- **A generated API client (e.g. from OpenAPI)** — not adopted; the manual
  hook-per-resource layer stays intentionally thin since routes already share
  Zod contracts with the server via `@devdigest/shared`.

## Consequences

- Adding a new resource means adding one hook, not scattering fetch calls.
- All caching/invalidation behavior is TanStack Query's, applied consistently.
- Unit tests can mock at a single boundary (`fetch`) and exercise real hook
  logic.
- New contributors must know to look in `src/lib/hooks/*` before reaching for
  `fetch` — also documented in `client/CLAUDE.md` Gotchas.
