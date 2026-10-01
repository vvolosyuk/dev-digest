# ADR-001: No monorepo/workspace tool — standalone packages + tsconfig path aliases

**Status:** Accepted

## Context

DevDigest is split into four packages (`server`, `client`, `reviewer-core`,
`e2e`) that need to share code (Zod contracts, the review engine) despite
each being independently installable. The project also intentionally ships
as a course starter where each lesson is a self-contained diff to one or two
packages.

## Decision

No workspace tool (no pnpm/npm/turborepo workspaces). Each package has its
own `package.json` and lockfile. Cross-package code sharing happens two ways:
(1) vendored copies under `src/vendor/*` for genuinely shared runtime code
(see `../../client/docs/adr-002-vendored-shared-packages.md`), and (2)
tsconfig path aliases for packages consumed as TypeScript source — e.g.
`server` aliases `@devdigest/reviewer-core` → `../reviewer-core/src` and
consumes it directly via tsx/vitest, with no build/publish step.

## Alternatives considered

- **pnpm workspaces** — rejected: would let students `pnpm install` once at
  the root, but couples package versions/lifecycles together in a way that
  conflicts with "each lesson only touches the files it needs to."
- **Publishing `reviewer-core` as a built npm package** — rejected: adds a
  build+publish step for a package that's supposed to stay a pure, directly
  readable TypeScript source tree (`reviewer-core`'s own `build` is just a
  type-check, per its README).

## Consequences

- Package folder renames require updating every tsconfig path alias that
  points at it (top-level `CLAUDE.md` "Naming conventions").
- Every package must expose the same script names (`dev`/`build`/`test`/
  `typecheck`) regardless of runner, since there's no workspace-level task
  runner to normalize this.
- Each package is independently `npm`/`pnpm install`-able, matching the
  course's "here's this lesson's diff" pedagogy.
