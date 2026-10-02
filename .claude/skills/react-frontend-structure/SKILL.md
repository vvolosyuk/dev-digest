---
name: react-frontend-structure
description: Where code goes in the DevDigest studio (client/, Next.js 15 App Router + React 19 + TanStack Query). Use when creating, moving, splitting or reviewing components, hooks, helpers, constants or routes under client/src — deciding between colocated vs. shared, _components/ nesting, constants.ts vs. helpers.ts vs. a custom hook, where data fetching and business logic live, and how thin page.tsx should be. Triggers on "where should this go", "folder structure", "split this component", "extract hook", "constants placement", "helpers vs hook", "_components", "colocate", "promote to shared", "page.tsx too big".
version: 1.0.0
metadata:
  tested-with: "next@15.1, react@19, @tanstack/react-query@5.62, next-intl@3.26, typescript@5.7"
---

# React frontend structure — DevDigest studio (v1.0.0)

**Colocate first, promote on second use.** Code lives next to the one thing that uses it; it moves outward only when a second consumer appears — never in anticipation of one.

```
 Route        src/app/<route>/page.tsx            thin entry: params → one view
   │ renders
 Route-private src/app/<route>/_components/Name/   view + its subtree (never routable)
   │ nests                └─ _components/Child/    one level per parent
 Shared UI    src/components/<Name>/              used by ≥2 routes
 Shared logic src/lib/<topic>.ts                   non-UI, used by ≥2 features
 Data         src/lib/hooks/<resource>.ts → src/lib/api.ts   the ONLY data path
 Vendored     src/vendor/{ui,shared}               read-only (@devdigest/ui, @devdigest/shared)
```

Imports point **down this diagram** (route → shared → lib → vendor), never up and never sideways into another route's tree.

## A. Placement: colocate, then promote (MEDIUM)

- Start inside the component folder that uses it. Used by a sibling → lift to the parent's folder. Used by another route → move to `src/components/` (UI) or `src/lib/<topic>.ts` (logic/constants) — e.g. `lib/severity.ts` became shared after three panels each had their own copy.
- **Never import from another route's `_components/` or helpers** (`@/app/...` from a different route). That is a missed promotion: move the code, then import it from both places.
- `src/lib/**` and `src/components/**` never import from `src/app/**`.
- Path alias: use `@/…` for anything outside the current component's own subtree; relative `./` / `../Sibling` only inside it. No `../../../../lib/...` chains.

## B. Component folder anatomy (MEDIUM)

```
Name/
  Name.tsx          the component (PascalCase folder = file = export)
  index.ts          export { Name, Name as default } from "./Name";
  Name.test.tsx     colocated test, when tested
  constants.ts      values only (see D)
  helpers.ts        pure functions only (see E)   (+ helpers.test.ts)
  styles.ts         co-located style objects (`export const s = { … }`)
  hooks/useX.ts     component-private hooks, when it has any
  _components/Child/  subcomponents used only by Name — same anatomy, recursively
```

- Every component folder has an `index.ts`; consumers import the folder (`"../RunHistory"`), not the file inside it.
- The `_` in `_components/` is Next.js's private-folder marker — keep it under `src/app/**`. Shared `src/components/**` may also use `_components/` for private children.
- Only create the optional files when there is something to put in them.

## C. Splitting components: on evidence, not on rule (MEDIUM)

Extract a child component when one of these is **observed**, not anticipated:
1. the same JSX/logic appears in two places;
2. a block has its own state/effects/handlers that the rest of the component doesn't touch;
3. props are drilled through a layer that doesn't use them → pass `children`/slots instead;
4. the file does several unrelated things (≈ >200 lines is the review smell, not a hard limit).

Don't create container/presentational pairs — its author retracted the pattern. Separate stateful logic from rendering with a **custom hook** in `hooks/`, not with a wrapper component.

## D. Constants (MEDIUM)

- Module-level constant values go in the component's `constants.ts`, `SCREAMING_SNAKE_CASE` (`MODEL_COLOR`, `SEVERITY_ORDER`). Promote per rule A.
- Closed sets: `as const` object/array + derived union type, not `enum`.
- No magic numbers/strings inline in JSX or effects (timeouts, limits, query intervals, colour maps).
- **User-visible text is not a constant**: it goes in `client/messages/en/<area>.json` via `next-intl`.
- Shared wire types and schemas come from `@devdigest/shared`; don't redeclare them in `constants.ts`/`types.ts`.

## E. Helper or hook? (MEDIUM; HIGH if a helper calls a hook)

- **Calls a React hook → it is a hook**: name it `useX`, put it in `hooks/useX.ts` (component-private) or `src/lib/hooks/` (data). Otherwise it is **a plain function** in `helpers.ts` — even if it's only used by one component.
- `helpers.ts` / `constants.ts` never import from `react` or call `use*`; they stay pure and unit-testable without rendering.
- Don't wrap a pure computation in a hook just to "keep React stuff together" — and don't `useMemo` it unless profiling says so.

## F. Data and business logic (HIGH)

- Server data: component → `src/lib/hooks/<resource>.ts` (TanStack Query) → `src/lib/api.ts`. Components never `fetch`, never call `api.*`, never build query keys. Importing `ApiError` for `instanceof` checks is fine.
- Cache invalidation and optimistic updates belong in the mutation hook's `onSuccess`/`onSettled`, not in the page or component (`useQueryClient` in `src/app/**` is a smell).
- Domain rules (sorting by severity, cost formatting, verdict derivation) are pure functions in `helpers.ts` or `src/lib/<topic>.ts` — not inline in JSX, not inside effects.
- Client UI state stays as low as possible (state colocation); lift only to the nearest common parent that needs it.

## G. App Router (MEDIUM; RSC boundary issues → defer to `next-best-practices`)

- `page.tsx` is thin: read params, render one view from `_components/`. Layout logic, data orchestration and handlers live in the view or its hooks.
- Route segments may hold only `page|layout|loading|error|not-found|route` files plus `_components/`, route-level `constants.ts`/`helpers.ts`/`styles.ts`, and tests.
- Put `"use client"` on the lowest component that needs it, not on the page by default.

## Workflow

1. For each new/moved file, find its consumers; place it per A (lowest common folder), with the anatomy in B.
2. Before extracting or splitting, name the evidence from C.
3. Classify each non-component function per E; put values per D; route data per F.
4. Run `references/review-checklist.md`. When reviewing, report `file:line — rule A–G — suggested move/fix`. Known pre-existing violations are listed there — don't widen them, fix them in files you touch.

## References

- `references/review-checklist.md` — grep checks + known violations
- `references/sources.md` — annotated sources per topic, known gaps, versions, changelog
- `client/AGENTS.md` — module naming conventions (authoritative where they overlap)
- Related skills: `react-best-practices` (component/hook anti-patterns), `next-best-practices` (RSC boundaries, file conventions), `react-testing-library` (tests)
