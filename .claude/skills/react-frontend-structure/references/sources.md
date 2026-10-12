# Sources, versions, changelog

**Skill version: 1.0.0** (2026-10-02) — semver: major = a placement rule in
`SKILL.md` changes, minor = new rule/reference or sources added/dropped,
patch = wording.

## Changelog

- **1.0.0** (2026-10-02) — `SKILL.md` written from this list and mapped onto
  `client/AGENTS.md`; this file moved from `README.md` to
  `references/sources.md`; `references/review-checklist.md` added.
- **0.1.0** (2026-10-01) — sources only (this list), no `SKILL.md`.

## Stack versions this skill was written against (`client/package.json`)

next ^15.1.3 · react ^19.0.0 · @tanstack/react-query ^5.62.8 · next-intl
^3.26.0 · zod ^3.24.1 · typescript ^5.7.2. Re-check the App Router section when Next.js changes major.

## Scope

The research/citation base for the `react-frontend-structure` skill
(structural/organizational guidance, as opposed to the anti-pattern catalogs
already covered by [`react-best-practices`](../../react-best-practices/SKILL.md)
and [`next-best-practices`](../../next-best-practices/SKILL.md)). Bump the
minor/patch version above on any pass that adds, drops, or revises sources
below.

This compiles and annotates the most authoritative, current (2024–2026,
React 18/19 and Next.js 15 era) sources found on six sub-topics: component
folder structure, component splitting/decomposition, constants placement,
utils vs. custom hooks, business logic placement, and Next.js App Router
structure. Scope is general React/frontend practice, not tied to this repo's
own conventions (see `client/AGENTS.md` for those). Produced via deep
research (6 parallel research passes + synthesis) on 2026-10-01.

Three sources recur across nearly every topic and anchor the whole
reference: **react.dev** (official, deliberately silent on file organization
but authoritative on React-specific mechanics — Hooks, composition,
Server/Client Components), **bulletproof-react**
([alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react),
the most-cited OSS reference architecture, community-maintained, not
Vercel/Meta-official), and **Feature-Sliced Design / FSD**
([feature-sliced.design](https://feature-sliced.design/), a formal,
tool-enforceable methodology, current spec v2.1). Individual practitioner
voices — Dan Abramov, Kent C. Dodds, Robin Wieruch, Nadia Makarevich, TkDodo
— supply the conceptual vocabulary (colocation, compound components, "push
state down") that the reference architectures operationalize into folders
and lint rules.

Lower-confidence, unverified, or gap-flagged sources are marked as such in
each section's "Known gaps" rather than smoothed over.

---

## 1. Component folder structure

- **Title:** React Folder Structure Best Practices (updated May 5, 2026)
  **URL:** https://www.robinwieruch.de/react-folder-structure/
  **Type:** Practitioner article (Robin Wieruch)
  **Note:** Describes a progression (flat → technical folders → `features/` → monorepo packages/domains/apps) and states the core promotion rule: a util/constant/hook lives inside a feature until a second feature needs it, then moves to a shared layer. Also the clearest source on monorepo-scale structure (apps → domains → packages, one-directional dependency).

- **Title:** bulletproof-react — project-structure.md
  **URL:** https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
  **Type:** OSS reference architecture (community-maintained, not framework-official)
  **Note:** Defines the two-tier `src/components` (shared) vs. `src/features/<feature>/components` (scoped) model, enumerates feature subfolders (api, components, hooks, stores, types, utils — only as needed), and enforces a `shared → features → app` import direction via an `import/no-restricted-paths` ESLint rule.

- **Title:** Feature-Sliced Design — official docs
  **URL:** https://feature-sliced.design/
  **Type:** OSS reference architecture / formal methodology (current v2.1, maintained 2018–2025)
  **Note:** Defines a fixed layer stack (app, processes, pages, widgets, features, entities, shared) and requires each slice to expose a public API (`index.ts`); more prescriptive than bulletproof-react, which gives one macro rule and leaves intra-feature layout to the team.

- **Title:** Thinking in React
  **URL:** https://react.dev/learn/thinking-in-react
  **Type:** Official docs
  **Note:** Gives zero folder/file-structure guidance — only covers logical decomposition of UI into a component hierarchy (one component, one concern). Confirms that React's own docs deliberately stay silent on physical organization.

- **Title:** Colocation
  **URL:** https://kentcdodds.com/blog/colocation
  **Type:** Practitioner article (Kent C. Dodds)
  **Note:** States the canonical principle "place code as close to where it's relevant as possible," crediting Dan Abramov for the underlying idea ("things that change together should be located as close as reasonable"). Operationalizes Abramov's meta-principle into concrete per-component colocation practice.

- **Title:** State Colocation will make your React app faster
  **URL:** https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster
  **Type:** Practitioner article (Kent C. Dodds)
  **Note:** Extends colocation from file layout to state placement — keep state as close as possible to where it's used, for both readability and render-performance reasons.

- **Title:** "Move files around until it feels right"
  **URL:** https://dev.to/dance2die/move-files-around-until-it-feels-right-2lek
  **Type:** Practitioner article (secondary source quoting Abramov)
  **Note:** Widely cited paraphrase of Dan Abramov's folder-structure stance. **Caveat:** the original tweet is no longer live; this is a well-attested paraphrase, not a directly verifiable primary-source quote.

- **Title:** Atomic Design, Chapter 2
  **URL:** https://atomicdesign.bradfrost.com/chapter-2/
  **Type:** Official source for the methodology (Brad Frost, concept 2013, book 2016)
  **Note:** Defines the five-stage atoms/molecules/organisms/templates/pages hierarchy for design-system component organization ("build systems, not pages").

- **Title:** Brad Frost's Atomic Design: build systems, not pages
  **URL:** https://www.designsystems.com/brad-frosts-atomic-design-build-systems-not-pages/
  **Type:** Practitioner/secondary summary
  **Note:** Secondary explainer of Frost's methodology; useful as a concise restatement, not a primary addition.

- **Title:** Rethinking Atomic Design in React Projects
  **URL:** https://cheesecakelabs.com/blog/rethinking-atomic-design-react-projects/
  **Type:** Practitioner article (last updated August 15, 2026)
  **Note:** Argues React implementations of atomic design often go wrong — components accumulate business rules they shouldn't know about, or multiply beyond need — and recommends keeping atomic components "dumb" while pushing business logic to a service/page layer, rather than abandoning atomic design outright.

### Known gaps
- No quantified/empirical comparison (controlled study) of feature-based vs. type-based structure exists in any source found — all guidance is practitioner-opinion/experience-based.
- No live, authoritative Dan Abramov primary source (blog post or talk transcript) stating the colocation/"move files around" principle directly was found — only secondary citation survives.
- A 2025 article claiming atomic design is "rarely used" in 2025 frontend projects (https://www.designsystemscollective.com/is-atomic-design-still-relevant-in-2025-d9c214788cfe) returned HTTP 403 on direct fetch; its claims are relayed only via search-engine summary — treat as directional, not verified.
- No source was found addressing React Server Components' effect on monorepo package boundaries (e.g., whether a shared UI package must mark itself client-only).

**Synthesis:** Official React docs stay silent on folder structure by design, leaving the question to the ecosystem. The strongest convergence across independent sources (Wieruch, bulletproof-react, FSD) is a "colocate first, promote on second use" rule applied uniformly to components, utils, hooks, and constants — not a specific taxonomy. Atomic design is the outlier: still legitimate for design-system/component-library code, but practitioner sources describe it losing ground to feature-based structures for application/business-logic code.

---

## 2. Component splitting / decomposition

- **Title:** Presentational and Container Components
  **URL:** https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
  **Type:** Primary source (original author, Dan Abramov), with a Feb 17, 2019 retraction update appended
  **Note:** Abramov's own update states "I don't suggest splitting your components like this anymore" — Hooks let him separate stateful logic from everything else "without an arbitrary division." The pattern's originator retracted the prescription himself; this is the single most load-bearing citation for this sub-topic.

- **Title:** Goodbye presentational and container components?
  **URL:** https://www.samdawson.dev/article/container-components/
  **Type:** Practitioner article (secondary summary of Abramov's retraction)
  **Note:** Adds that Abramov had seen the pattern "enforced without any necessity and with almost dogmatic fervor" — i.e., it was never meant as a universal rule.

- **Title:** Container Vs Presentational Components: Still Relevant In 2025?
  **URL:** https://allinsightlab.com/container-vs-presentational-components-still-relevant-in-2025/
  **Type:** Practitioner article
  **Note:** 2025 retrospective concluding the pattern "isn't completely dead" but that the "container" role is now usually a custom hook rather than a wrapper component.

- **Title:** React Design Principles
  **URL:** https://legacy.reactjs.org/docs/design-principles.html
  **Type:** Official docs (legacy)
  **Note:** Frames composition itself — not any specific container/presentational split — as React's core architectural value, and explicitly avoids mandating a particular split pattern.

- **Title:** React components composition: how to get it right
  **URL:** https://www.developerway.com/posts/components-composition-how-to-get-it-right
  **Type:** Practitioner article (Nadia Makarevich, April 12, 2022)
  **Note:** Gives the clearest size heuristic found anywhere — "fits on the screen of my laptop entirely" — plus performance-driven extraction triggers (isolate state unrelated to a component's core purpose to prevent unnecessary sibling re-renders). Demonstrates the functional equivalent of "push state down / lift content up" via `children`.

- **Title:** When to Split a React Component (And When You're Over-Engineering)
  **URL:** https://dev.to/137foundry/when-to-split-a-react-component-and-when-youre-over-engineering-2a6e
  **Type:** Practitioner article
  **Note:** Lists good reasons to split (genuine reuse, narrower responsibility, isolated testability, readability) versus explicit anti-patterns (splitting for file length alone, splitting before a pattern appears twice). Key line: "A 400-line component split into two 200-line files with the same interleaved concerns has not improved anything."

- **Title:** bulletproof-react — components-and-styling.md
  **URL:** https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md
  **Type:** OSS reference architecture
  **Note:** Warns against multiple rendering functions inside one component; recommends extracting a component for any distinguishable logical UI unit. Also states "identify repetitions before creating the components to avoid wrong abstractions" — extraction should follow observed duplication, not anticipate it.

- **Title:** Passing Data Deeply with Context
  **URL:** https://react.dev/learn/passing-data-deeply-with-context
  **Type:** Official docs
  **Note:** States the recommended order of solutions: explicit props first, then composition via `children`, only then Context. Gives the one concrete, official "necessity" signal for extraction: deep prop drilling of data that intermediate components don't use ("you forgot to extract some components along the way").

- **Title:** React Hooks: Compound Components
  **URL:** https://kentcdodds.com/blog/compound-components-with-react-hooks
  **Type:** Practitioner article (Kent C. Dodds, Feb 18, 2019)
  **Note:** Defines compound components (parent + children sharing implicit state, e.g. `<select>`/`<option>`) and documents the modern Hooks-era implementation via `React.createContext()` + `useContext()`, replacing the older `React.cloneElement()` approach.

- **Title:** Mixing Component Patterns
  **URL:** https://kentcdodds.com/blog/mixing-component-patterns
  **Type:** Practitioner article (Kent C. Dodds)
  **Note:** Catalogs and combines compound components, render props, component injection, provider pattern, and HOCs in one example; argues render props is the foundational pattern since all others can be built on top of it.

- **Title:** React Component Composition
  **URL:** https://www.robinwieruch.de/react-component-composition/
  **Type:** Practitioner article (Robin Wieruch)
  **Note:** States composition over inheritance as the recommended default for React component structure; separately names and documents a "Slot Pattern" for dynamically exchangeable child content.

### Known gaps
- No authoritative source gives a numeric line-count or prop-count threshold for "split this component" — every credible source uses qualitative heuristics only. Any such specific number appearing elsewhere should be treated as unsupported.
- No source specifically and verifiably addresses React 19 Server Components' effect on the container/presentational debate — a DEV Community title on this surfaced in search but was not fetched/verified.
- Josh W. Comeau's "Delightful React File/Directory Structure" and his Joy of React "Custom Hooks" lesson plausibly bear on splitting heuristics but were not independently verified (the latter is paywalled) — omitted rather than guessed.
- No React-specific source attributes a "rule of three" (extract after three occurrences) the way general software engineering sometimes does — only a looser "appears, or could plausibly appear, in multiple places" framing was found.

**Synthesis:** The container/presentational split is a textbook case of a named pattern being retracted by its own originator — Abramov's 2019 update is unambiguous. What survives is the underlying goal (separate stateful logic from rendering), now achieved via custom hooks and composition (`children`) rather than a prescribed component pair. Every source, official and practitioner alike, converges on evidence-based extraction (observed duplication, proven separable responsibility, actual prop-drilling) over rule-based or anticipatory extraction.

---

## 3. Constants placement

Coverage note: this is a narrower topic than the others. Primary/canonical sources speaking *directly and explicitly* to constants placement are thin; most reference architectures only gesture at it via a `config` folder/segment.

- **Title:** bulletproof-react — project-structure.md
  **URL:** https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
  **Type:** OSS reference architecture
  **Note:** Places global configuration/constants in a top-level `config` folder ("global configurations, exported env variables etc."); no feature-level `constants` subfolder is enumerated, implying feature-local constants colocate with the relevant component/util files.

- **Title:** bulletproof-react GitHub issue #139 (comment)
  **URL:** https://github.com/alan2207/bulletproof-react/issues/139#issuecomment-1976197893
  **Type:** Practitioner opinion (community member, **not** the repo maintainer)
  **Note:** Recommends a dedicated `constants` folder with files like `options.ts` for large, unchanging arrays. **Caveat:** author association is "NONE," no maintainer response in the thread — treat as community opinion, not canonical project guidance.

- **Title:** Feature-Sliced Design — segments reference
  **URL:** https://feature-sliced.design/docs/reference/slices-segments
  **Type:** Official FSD docs
  **Note:** Formally defines a `config` segment ("configuration files and feature flags") usable at any layer, including `shared`.

- **Title:** FSD: The Perfect Folder Structure for Scalable Frontend
  **URL:** https://feature-sliced.design/blog/frontend-folder-structure
  **Type:** Official FSD blog (dated Dec 5, 2025)
  **Note:** Shows a concrete example placing application-wide constants at `shared/config/constants.ts` — promoted to `shared` once used across features, consistent with FSD's "shared cannot import from above" rule.

- **Title:** React Folder Structure Best Practices (2026)
  **URL:** https://www.robinwieruch.de/react-folder-structure/
  **Type:** Practitioner article
  **Note:** Treats constants as one of several "technical concerns" (with styles, tests, utilities, types) colocated as `constants.ts` next to a component when feature-specific, implying the same promote-when-shared logic as utils.

- **Title:** Airbnb JavaScript Style Guide
  **URL:** https://github.com/airbnb/javascript
  **Type:** Official/widely-adopted style guide
  **Note:** Covers camelCase for objects/functions and PascalCase reserved for constructors/classes, but **contains no rule for SCREAMING_SNAKE_CASE or any special constant casing** — notably silent on this specific question.

- **Title:** What Are Magic Numbers And Why Are They Bad
  **URL:** https://blog.webdevsimplified.com/2020-02/magic-numbers/
  **Type:** Practitioner article (Feb 10, 2020 — **predates the 2024–2026 target window**)
  **Note:** Recommends UPPER_SNAKE_CASE for global constants and gives the clearest extraction-trigger heuristic found: extract if meaning isn't obvious, if duplicated, or if likely to change.

- **Title:** TypeScript Enums Are Still Controversial in 2026 — Here Is When To Use Them
  **URL:** https://dev.to/jsmanifest/typescript-enums-are-still-controversial-in-2026-here-is-when-to-use-them-and-when-to-reach-for-4fee
  **Type:** Practitioner article (published Aug 7, 2026)
  **Note:** States the settled-by-2026 convention: use `as const` objects for general-purpose constants (zero runtime cost, tree-shakeable); reserve `enum` for cases needing reverse mapping, bitwise flags, or strict external-contract validation.

- **Title:** TypeScript 3.4 Release Notes
  **URL:** https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html
  **Type:** Official docs
  **Note:** Introduces `as const` and explicitly demonstrates it as an "enum-like pattern in plain JavaScript" — the primary-source origin of the `as const`-over-`enum` convention.

- **Title:** Kent C. Dodds on X (tweet)
  **URL:** https://twitter.com/kentcdodds/status/841429439380615169
  **Type:** Practitioner social-media post (weak source — not a canonical article)
  **Note:** States a rationale for extracting named variables generally: to "illustrate to the reader that these things are related/change together," not just to save typing.

### Known gaps
- No source gives a crisp quantified rule like "promote a constant after N usages" — every source is directional/qualitative ("once used in more than one feature").
- No authoritative, recent (2024–2026) style guide explicitly standardizes constant casing (SCREAMING_SNAKE_CASE vs. camelCase vs. PascalCase-named `as const` objects) in a React/TypeScript context — the clearest statement found (Web Dev Simplified) predates the window.
- No ESLint/typescript-eslint `naming-convention` rule documentation was independently verified in this pass to corroborate tooling defaults.
- Neither bulletproof-react nor FSD gives constants dedicated first-class folder status distinct from "config" — both subsume it under a broader configuration concept.
- The "practitioner article" leg of sourcing for magic-number extraction specifically in a React context (as opposed to general programming) is thin — no matching Josh W. Comeau or dedicated 2024–2026 Kent C. Dodds article was found.

**Synthesis:** Constants placement isn't treated as its own architectural decision by any reference architecture — it's folded into the broader "config" concept, and both bulletproof-react and FSD apply the same colocate-then-promote rule used for utils and hooks. Casing conventions, by contrast, show genuine disagreement/silence: the most-adopted style guide (Airbnb) takes no position, while the `enum` vs. `as const` question is comparatively well-settled in favor of `as const`.

---

## 4. Utils/helpers vs. custom hooks

- **Title:** Reusing Logic with Custom Hooks
  **URL:** https://react.dev/learn/reusing-logic-with-custom-hooks
  **Type:** Official docs
  **Note:** The single most authoritative source for this topic. States the mechanical rule directly: name a function with the `use` prefix (making it a Hook) if and only if it calls at least one other Hook inside it; otherwise write it as a plain function. Also frames custom Hooks specifically as an Effect-extraction mechanism, not a general-purpose reuse tool — explicitly discourages extracting a hook "for every little duplicated bit of code" and names `useMount`/`useEffectOnce`/`useUpdateEffect`-style wrapper hooks as anti-patterns.

- **Title:** Writing Custom Hooks in React: Patterns, Pitfalls, and When to Reach for One
  **URL:** https://certificates.dev/blog/writing-custom-hooks-in-react-patterns-pitfalls-and-when-to-reach-for-one
  **Type:** Practitioner article (Aurora Scharff, May 21, 2026)
  **Note:** Explains the *tooling* consequence of the `use` prefix — ESLint's Rules-of-Hooks/exhaustive-deps linting keys off the prefix, so mislabeling breaks lint coverage. Gives a positive three-point extraction test: duplicated stateful logic, synchronizing with an external system, or hiding complexity behind a clear name. Recommended workflow: write inline first, extract on the second occurrence, check the ecosystem before building something that exists.

- **Title:** Kent C. Dodds on X (tweet)
  **URL:** https://twitter.com/kentcdodds/status/1246072673488138242
  **Type:** Practitioner social-media post (weak source, but widely cited)
  **Note:** Concise framing: "A custom component is a function that accepts an object and returns something React can render. A custom hook is a function that uses other hooks."

- **Title:** React Hooks Anti-Patterns: A Comprehensive Guide to Avoiding Common Pitfalls
  **URL:** https://techinsights.manisuec.com/javascript/react-hooks-antipatterns/
  **Type:** Practitioner article
  **Note:** Catalogs "functions disguised as hooks" (e.g. `useRandomNumber()` calling no hooks internally) as a named anti-pattern — mirrors react.dev's official rule from the practitioner side.

- **Title:** bulletproof-react — project-structure.md
  **URL:** https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
  **Type:** OSS reference architecture
  **Note:** Uses parallel top-level `hooks/` and `utils/` folders (shared, app-wide) plus feature-scoped `hooks/`/`utils/` inside each feature folder — same colocate-then-promote pattern applied identically to both kinds of code.

- **Title:** Let's Learn Feature-Sliced Design (FSD)
  **URL:** https://dev.to/nyaomaru/lets-learn-feature-sliced-design-fsd-15bb
  **Type:** Practitioner article
  **Note:** Describes FSD's segment convention (`ui/`, `api/`, `model/`, `lib/`, `config/`) within each slice — `lib/` is where slice-specific utilities live, distinct from `model/` (types, schemas, business logic).

- **Title:** Mastering React Hooks: An Architectural Guide
  **URL:** https://feature-sliced.design/blog/react-hooks-architecture
  **Type:** Official FSD blog (Evan Carter, Feb 10, 2026)
  **Note:** The most granular hook-placement guidance found: generic/framework hooks (`useDebounce`) → `shared/lib`; entity-specific domain hooks (`useUser`) → `entities/<entity>/model`; feature workflow hooks (`useAddToCart`) → `features/<feature>/model`. States this "semantic placement" reduces the odds of a hook becoming an unowned global dependency. **Caveat:** this is a blog post, not the core FSD spec page — treat as authoritative-adjacent, not the literal methodology text.

- **Title:** How to test custom React hooks
  **URL:** https://kentcdodds.com/blog/how-to-test-custom-react-hooks
  **Type:** Practitioner article (Kent C. Dodds, March 22, 2020)
  **Note:** Explains why hooks can't be unit-tested like pure functions — they can only be called inside a component's render body — and recommends testing through a realistic consuming component (or `renderHook`) rather than mocking React's built-in hooks, which "throw[s] away a LOT of confidence."

### Known gaps
- No source gives quantified/empirical data (e.g., lines of test setup, measured effort delta) on how much harder hook testing is versus pure-function testing — all sourcing here is qualitative/explanatory.
- No dedicated, primary-source Kent C. Dodds essay specifically contrasting "custom hook" vs. "utility function" (beyond the tweet) was found within the research budget.
- Josh W. Comeau's "Custom Hooks" lesson (courses.joshwcomeau.com) is paywalled — no verbatim content could be captured; omitted rather than reported secondhand.
- The FSD hook-placement-by-domain guidance comes from a blog post, not FSD's core reference spec — flagged as authoritative-adjacent rather than canonical methodology text.

**Synthesis:** This is the most settled sub-topic of the six — react.dev's official rule (hooks call hooks; otherwise, plain function) is mechanical, tooling-reinforced (ESLint keys off the `use` prefix), and independently echoed by every practitioner and reference-architecture source found with zero contradiction. The only genuine extension beyond the official rule is FSD's placement-by-domain-ownership refinement, which bulletproof-react doesn't make explicit.

---

## 5. Business logic placement

- **Title:** bulletproof-react — project-structure.md
  **URL:** https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
  **Type:** OSS reference architecture
  **Note:** Organizes each feature into `api/` (requests + API hooks), `components/`, `hooks/`, `stores/`, `utils/`; pairs the folder convention with an enforced `import/no-restricted-paths` ESLint rule preventing cross-feature imports — a meaningful differentiator from convention-only sources.

- **Title:** Using Custom Hooks in React to Encapsulate Service Logic
  **URL:** https://medium.com/@szz185/using-custom-hooks-in-react-to-encapsulate-service-logic-f60d24410bbf
  **Type:** Practitioner article
  **Note:** States the general practitioner framing: "the component is now focused solely on rendering the UI, while the custom hook handles the business logic," citing testability and reusability as the payoffs.

- **Title:** Custom Hooks in React: Streamlining Business Logic for Cleaner Code
  **URL:** https://siddarth-bulusu.medium.com/custom-hooks-in-react-streamlining-business-logic-for-cleaner-code-af9425244098
  **Type:** Practitioner article
  **Note:** Same tier-1 (React-coupled logic → hooks) framing as above; representative of a broad cluster of similar Medium/DEV.to posts.

- **Title:** Does DDD Belong on the Frontend?
  **URL:** https://khalilstemmler.com/articles/typescript-domain-driven-design/ddd-frontend/
  **Type:** Practitioner article (Khalil Stemmler, published/updated Aug 1, 2022)
  **Note:** The clearest "tier-2" source: argues for a framework-agnostic domain layer (value objects, entities) and application layer (use cases) that deliberately exclude React components/hooks/context, keeping validation logic as reusable classes rather than scattered through components or even through Zod schemas. The closest React-world equivalent to "fat models, thin views" (a phrase that itself originates in Rails/MVC, not React).

- **Title:** Feature-Sliced Design — Overview
  **URL:** https://feature-sliced.design/docs/get-started/overview
  **Type:** Official FSD docs (spec v2.1)
  **Note:** Names Entities (core business/domain model, e.g. users, reviews) and Features (user-facing business actions on those entities) as distinct, hierarchically separated layers with enforced one-way imports — the most rigorously specified domain/use-case split of any source reviewed.

- **Title:** Working with Zustand
  **URL:** https://tkdodo.eu/blog/working-with-zustand
  **Type:** Practitioner article (TkDodo, a TanStack Query maintainer, Nov 20, 2022)
  **Note:** Recommends modeling store actions as named events, not raw setters — "the store decides what a state transition means," citing the Redux style guide's "keep business logic inside your store, and not in your components." Demonstrates combining Zustand (client state) with TanStack Query (server state) via a custom hook.

- **Title:** TanStack Query v3 Custom Hooks example
  **URL:** https://tanstack.com/query/v3/docs/framework/react/examples/custom-hooks
  **Type:** Official docs (**v3-era — not the current version**; current official page for this exact pattern was not independently re-fetched)
  **Note:** Ecosystem convention — wrap every `useQuery`/`useMutation` in a dedicated custom hook rather than calling them directly in components, for encapsulation and type safety.

- **Title:** Conditional Logic with Zod + React Hook Form
  **URL:** https://micahjon.com/2023/form-validation-with-zod/
  **Type:** Practitioner article
  **Note:** For cross-field business rules, recommends Zod's object-level `.refine()` rather than field-level validation — the mainstream/pragmatic (non-DDD) answer to where validation logic lives, as a schema outside the component, shared between client and server.

### Known gaps
- Could not independently fetch the full content of Kent C. Dodds' "Separation of rendering vs logics: custom hooks" (https://kentcdodds.com/calls/02/09/separation-of-rendering-vs-logics-custom-hooks) — it's a members/call resource; treat as a title/topic confirmation only, not a verified quote.
- No single canonical "fat models, thin views, React edition" essay exists — the phrase is Rails/MVC in origin; no conference talk (as opposed to blog articles) matching this exact theme for React was located.
- No source specifically addresses Jotai's atom-level business-logic conventions — research focused on Zustand/Redux Toolkit; this is an open gap.
- No well-known, explicitly official (React core team or Vercel) statement on validation placement exists — all sourcing here is practitioner/community, not maintainer-authored architectural guidance.
- A cluster of "2024 clean-architecture/DDD-in-React" community articles (presentation/application/domain/infrastructure four-layer split) was identified via search-result synthesis only; one specific attempted fetch (profy.dev) failed with a DNS error, so these claims represent a cluster, not an individually verified source.

**Synthesis:** There's a real two-tier split in how sources answer this question. Tier 1 (the large majority of practitioner content, plus bulletproof-react and TkDodo) says: React-coupled logic goes in custom hooks, state-transition logic goes in named store actions, and that's sufficient. Tier 2 (Stemmler's DDD argument, FSD's Entities/Features split) pushes further, insisting on a framework-agnostic domain layer that doesn't import React at all. No source argues tier 1 is wrong — tier 2 is additive rigor for larger/longer-lived codebases, not a competing camp.

---

## 6. Next.js App Router structure (Next.js 15, React 19)

- **Title:** Project structure and organization
  **URL:** https://nextjs.org/docs/app/getting-started/project-structure
  **Type:** Official docs (version 16.3.8 content, last updated 2026-07-21)
  **Note:** The single most important source for this topic. States plainly that only `page.js`/`route.js` make a route segment public, so any other file can be safely colocated inside a route folder; presents three equally valid top-level strategies (outside `app`, top-level inside `app`, split-by-feature/route) without prescribing one. Documents private `_folder` prefixes as an optional clarity convention, not a routing-safety requirement, and route groups `(folderName)` as purely organizational (no URL segment), usable for section-based organization and multiple/nested root layouts.

- **Title:** Server and Client Components
  **URL:** https://nextjs.org/docs/app/getting-started/server-and-client-components
  **Type:** Official docs (version 16.3.8, last updated 2026-08-25)
  **Note:** States the default-Server-Component rule and the concrete decision boundary: Server Components for data-fetching, secrets, and DB/ORM calls; Client Components (`'use client'`) only for state, event handlers, lifecycle hooks (`useEffect`), browser APIs, and Context providers. Explicit guidance to push `'use client'` to leaf components since "all of its imports... are included in the client bundle." Documents `import 'server-only'` as a build-time guard against secrets leaking into client bundles.

- **Title:** Fetching Data
  **URL:** https://nextjs.org/docs/app/getting-started/fetching-data
  **Type:** Official docs (version 16.3.8, last updated 2026-09-07)
  **Note:** Shows fetching directly inline in a Server Component as a fully valid minimal pattern (no mandatory abstraction layer); for non-`fetch` I/O (ORM/DB), recommends wrapping the query in React's `cache()` inside a `lib`-style module for in-request memoization. States preload functions should be colocated "next to the component that consumes the data," not centralized — a direct, official endorsement of per-component colocation over a generic data-access layer.

- **Title:** Server Actions
  **URL:** https://nextjs.org/docs/app/guides/server-actions
  **Type:** Official docs guide
  **Note:** Defines `'use server'` functions as callable from both Server and Client Components for form submissions/mutations. **Caveat:** this pass sourced the guide via search synthesis, not an independently re-verified direct fetch — treat exact current wording (especially caching/revalidation specifics) as lower-confidence pending verification.

- **Title:** Parallel and Intercepting Routes (DeepWiki summary)
  **URL:** https://deepwiki.com/vercel-labs/next-skills/4.4.3-parallel-and-intercepting-routes
  **Type:** Practitioner/third-party reference summary (**not primary Next.js docs**)
  **Note:** Clarifies that route groups and parallel-route "slots" (`@slot`) are distinct features that happen to share the "no URL impact" property; explains intercepting-route notation (`(.)`, `(..)`, `(..)(..)`, `(...)`) primarily for modal/multi-pane UI patterns, not general file organization.

- **Title:** Feature-Sliced Design: Next.js App Router guide
  **URL:** https://feature-sliced.design/blog/nextjs-app-router-guide
  **Type:** Practitioner/community blog adapting FSD to App Router (dated 2026-01-23, author "Evan Carter, Senior Frontend")
  **Note:** Recommends using `app/` for routing only and a separate `src/` tree for the FSD layer stack (app → pages → widgets → features → entities → shared), with routes assembling features/widgets rather than implementing domain logic directly. **Caveat:** third-party adaptation, not an official Next.js/Vercel source.

- **Title:** bulletproof-react — apps/nextjs-app
  **URL:** https://github.com/alan2207/bulletproof-react/blob/master/apps/nextjs-app/README.md
  **Type:** OSS reference architecture
  **Note:** Ships a dedicated Next.js App Router reference implementation alongside Vite SPA and Pages Router variants. **Caveat:** a direct fetch of this specific README in this research pass returned only setup/install instructions with no architectural content; the folder-structure description (strict module boundaries, one-way `app adapters → _app, _pages, shared` dependency flow) comes from secondary search-result summarization, not a verified primary-source quote — flagged as lower-confidence pending a follow-up fetch of the actual source tree.

- **Title:** Lee Robinson personal site (leerob) — repo structure
  **URL:** https://github.com/andrianspace/web-leerob
  **Type:** Practitioner reference — **flagged as outdated / not representative**
  **Note:** Uses a `pages/api`, `pages/blog` structure — this is Pages Router-era, not App Router. No primary, App-Router-specific architecture post from Lee Robinson was located; treat "Lee Robinson's App Router recommendation" as an open gap, not a confirmed source.

### Known gaps
- Official docs give no hard rule for *when* to promote a colocated route-level component to a shared top-level folder (e.g., "after 2 usages") — left entirely to team judgment.
- No official guidance was found on how Route Handlers (`route.ts`) should be organized relative to Server Actions — i.e., when to prefer one mutation mechanism over the other.
- Official docs do not address the specific pattern of a Next.js App Router frontend calling a *separate* backend API server (as opposed to direct DB/ORM access from Server Components) — no explicit "API client layer" convention or recommended location (e.g. `lib/api/`) exists in the primary docs for that scenario. Worth noting since this is a common real-world shape, not just a gap specific to any one project.
- The bulletproof-react Next.js App Router folder-by-folder structure was not confirmed via direct primary-source read — only secondary/search-synthesized description was obtained; a follow-up fetch of the actual source tree (not just the README) is needed for exact folder names.
- No independently re-verified fetch of the Server Actions guide was performed in this pass — treat specific wording as lower-confidence.

**Synthesis:** Official Next.js docs are unusually explicit and unopinionated at once: they precisely define what *is* safe (colocation, since only `page`/`route` are public) while declining to mandate *how* to use that safety, offering three named strategies as equally valid. OSS reference architectures (FSD-for-Next, bulletproof-react) layer a stricter opinion on top — treat `app/` as thin routing only, push business/domain logic into a separate `src/` tree with enforced one-way imports — effectively a scaled-up, enforced version of the official docs' "split by feature or route" option rather than a contradiction of it.
