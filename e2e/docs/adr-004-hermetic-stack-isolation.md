# ADR-004: Run e2e against an isolated, ephemeral stack, not the shared dev stack

**Status:** Accepted

## Context

Several flows (`02`, `04`, `05`) assume the seeded demo repo
(`acme/payments-api`) is the *only* repo in the database (e.g. the home route
redirects to "the first repo"). A developer's normal dev DB usually has other
imported repos, so running e2e straight against it makes those flows land on
the wrong repo and fail depending on import history.

## Decision

`./scripts/e2e.sh` boots a fully isolated stack — Postgres on an alternate
port (`:5433`, ephemeral, no persistent volume), API on `:3101`, web on
`:3100` — freshly seeds it, runs the flows, and tears everything down. This
is the recommended path and never touches the developer's real
`devdigest_pgdata` volume. Running against the shared dev stack
(`./scripts/dev.sh` + `npm test`) is supported but documented as only safe if
the dev DB happens to contain *only* the seeded repo.

## Alternatives considered

- **Always run against the developer's normal dev stack** — rejected:
  fragile (flows 02/04/05 break as soon as a second repo is imported) and,
  worse, tempts a "reset it first" workflow using `docker compose down -v`,
  which the README explicitly flags as destructive (`-v` deletes every real
  repo/review, not just e2e state).
- **Reset/truncate the dev DB before each e2e run** — rejected: destroys
  real imported data as a side effect of running tests, an unacceptable cost
  for a "safe by default" test command.

## Consequences

- e2e is safe to run at any time, even with a populated dev stack running
  alongside it (different ports, different Postgres instance).
- CI (`e2e-web.yml`) gets the same guarantee "for free" — an empty, freshly
  seeded Postgres — matching what flows 02/04/05 assume.
- The tradeoff is a second set of ports/env knobs to know about
  (`E2E_PG_PORT`, `E2E_API_PORT`, `E2E_WEB_PORT`, etc.) and a slower
  cold-start than reusing an already-running stack.
