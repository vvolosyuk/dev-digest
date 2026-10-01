# ADR-007: Ship the full DB schema (including unused future-lesson tables) from migration 0000

**Status:** Accepted

## Context

DevDigest is a multi-lesson course; later lessons (L02–L08) add features
like Skills, Memory, Eval, Blast Radius, and multi-agent review, each of
which needs its own tables. Students progress by applying lesson diffs to
the same running database.

## Decision

The Drizzle schema and migrations already define **every** table the full
course eventually uses, from the starter's migration 0000 — not just the
tables the starter (L01) actually reads/writes. Unused tables simply sit
empty until a later lesson's code starts using them.

## Alternatives considered

- **Add tables incrementally, one migration per lesson** — rejected: would
  mean every lesson ships its own migration (and its own migration-journal
  risk, see `server/CLAUDE.md`'s note on migration `2006964`), multiplying
  the chances of migration-journal breakage across 8 lessons.
- **Separate "future schema" migrations applied only when a lesson is
  reached** — rejected: adds a second migration-sequencing concept (which
  migrations are "active" per lesson) on top of Drizzle's own linear
  migration history.

## Consequences

- A student or reviewer who finds an empty, apparently unused table should
  not assume it's dead code or a bug — it's intentionally there for a later
  lesson (the top-level `CLAUDE.md` makes the same point about missing
  features; this ADR extends the idea to schema).
- The schema is the course's most stable artifact — a migration in the
  starter can't easily be un-shipped once students have run `db:migrate`
  against it, so schema mistakes in 0000 are costly. Per `server/CLAUDE.md`,
  migrations are never edited/deleted after the fact, only added to.
