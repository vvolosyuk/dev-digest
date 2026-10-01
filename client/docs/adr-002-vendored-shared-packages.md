# ADR-002: Vendor shared UI kit and contracts instead of a workspace tool

**Status:** Accepted

## Context

`client/`, `server/`, `reviewer-core/`, and `e2e/` are four standalone
packages with their own `package.json`/lockfile rather than a pnpm/npm/
turborepo workspace (see the top-level `AGENTS.md`). But some code genuinely
needs to be shared: UI primitives (`@devdigest/ui`) and Zod contracts
(`@devdigest/shared`).

## Decision

Shared code is vendored — copied into `src/vendor/ui` and `src/vendor/shared`
inside each consuming package — rather than published as real workspace
packages or npm packages. `server/src/vendor/shared` is the canonical
shared-contracts source; `client/src/vendor/*` mirrors it. These directories
are marked "do not touch" in `client/AGENTS.md`; changes belong upstream at
the source lesson.

## Alternatives considered

- **pnpm/npm/turborepo workspace with `workspace:*` deps** — rejected for
  this course starter: each lesson needs to hand a student a deployable diff
  to a *single* package without requiring them to understand cross-package
  workspace tooling; a real workspace also complicates the "four standalone
  packages" framing in the top-level README.
- **Publish `@devdigest/shared`/`@devdigest/ui` to a private npm registry** —
  rejected: adds infrastructure (registry, versioning, publish step)
  disproportionate to a course starter that runs entirely locally.

## Consequences

- Package independence is preserved at the cost of manual sync — a change to
  shared contracts must be applied at its source lesson and re-copied, not
  edited ad hoc in a consuming package.
- Renaming a package folder requires updating every tsconfig path alias that
  points at it (top-level `AGENTS.md`).
- Nothing enforces that `client/src/vendor/shared` matches
  `server/src/vendor/shared` except discipline — there is no automated drift
  check.
