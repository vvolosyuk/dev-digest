# ADR-002: Migrations are never applied automatically on boot

**Status:** Accepted

## Context

`server/` uses Drizzle over Postgres with a full schema, including tables for
not-yet-built future-lesson features (see
[ADR-007](adr-007-full-schema-upfront.md)). New developers frequently hit
`relation ... does not exist` errors on first run.

## Decision

The server does **not** run `pnpm db:migrate` on boot, even in dev.
Migrations are a deliberate, separate manual step, documented at the top of
`server/README.md`'s Troubleshooting section. `./scripts/dev.sh` runs
migrate+seed as part of the scripted quick start, but the manual path
requires the explicit step.

## Alternatives considered

- **Auto-migrate on server start** (common in many frameworks) — rejected:
  silently applying schema changes on every boot is risky against a real
  (non-course) Postgres instance, and turns migration failures into a
  boot-time crash instead of a visible, deliberate CLI action.
- **Auto-migrate only in `NODE_ENV=development`** — rejected: would create a
  behavior split between dev and prod that the starter doesn't want students
  to have to reason about.

## Consequences

- First-run friction (the #1 Troubleshooting entry) in exchange for
  predictable, explicit schema changes.
- CI and `./scripts/dev.sh` both must remember to call `db:migrate`
  explicitly — there's no safety net if a script forgets it.
