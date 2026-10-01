# ADR-003: Self-contained PascalCase component folders, colocated tests

**Status:** Accepted

## Context

The studio has a growing set of feature components (PR detail tabs, finding
cards, agent editor, etc.) alongside routed pages. A convention was needed
for where component logic, styles, and tests live, and how to keep Next.js
App Router page files thin.

## Decision

Components are self-contained PascalCase folders: `Name/Name.tsx`, with a
colocated `Name/Name.test.tsx` when tested. Subcomponents that only make
sense inside a parent nest one level under it in a `_components/` folder
(e.g. `RunTraceDrawer/_components/TraceBody/TraceBody.tsx`), reusing Next's
leading-underscore "never routable" convention to keep them out of the App
Router. Pages (`src/app/**/page.tsx`) stay thin; feature logic lives in these
colocated component folders.

## Alternatives considered

- **Flat `components/` directory** — rejected: doesn't scale past a handful
  of components and obscures which components are page-specific vs. shared.
- **Storybook-driven component development** — not adopted for the starter;
  adds tooling overhead without a clear course payoff at this stage.
- **Tests in a separate `__tests__/` tree** — rejected in favor of colocated
  `*.test.tsx`, which keeps a component and its test moving together on
  rename/delete.

## Consequences

- Consistent, predictable location for any component and its test.
- The `_components/` leading underscore must be preserved — accidentally
  dropping it makes the folder routable and breaks the App Router
  (documented in `client/CLAUDE.md` naming conventions).
- Page files stay reviewable at a glance since they don't carry feature
  logic.
