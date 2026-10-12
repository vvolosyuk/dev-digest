# Sources, versions, changelog

**Skill version: 1.0.0** (2026-10-01) — semver: major = layer rules change, minor = new reference/rule, patch = wording.

## Stack versions this skill was written against (`server/package.json`, `reviewer-core/package.json`)

fastify ^5.2.0 · fastify-type-provider-zod ^4.0.2 · zod ^3.24.1 · drizzle-orm ^0.38.3 · drizzle-kit ^0.30.1 · postgres ^3.4.5 · vitest ^2.1.8 · testcontainers ^10.16.0 · dependency-cruiser ^17.4.3 · typescript ^5.7.2 · Node ≥22. Re-check `references/*` when these majors change.

## Onion Architecture

- Jeffrey Palermo, The Onion Architecture part 1 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- part 2 — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
- part 3 — https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/
- part 4, After Four Years (2013) — https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/
- Herberto Graça, Onion Architecture — https://herbertograca.com/2017/09/21/onion-architecture/
- Software Architecture Chronicles, Onion Architecture — https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85
- Hexagonal architecture (comparison) — https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)
- Onion Architecture in Node.js + TypeScript — https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad
- Enforce clean architecture in TS (Fresh Onion) — https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi

## Fastify

- Plugins — https://fastify.dev/docs/latest/Reference/Plugins/
- Encapsulation — https://fastify.dev/docs/latest/Reference/Encapsulation/
- Plugins guide — https://fastify.dev/docs/latest/Guides/Plugins-Guide/
- Fastify plugins as building blocks (Snyk) — https://snyk.io/blog/fastify-plugins-for-backend-node-js-api/
- DI discussion — https://github.com/fastify/help/issues/284

## Drizzle / Repository

- Atomic Repositories in Clean Architecture and TypeScript (Sentry) — https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/
- Drizzle ORM Best Practices — https://blog.paulserban.eu/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/
- Transactions with DDD and Repository Pattern in TS — https://medium.com/@joaojbs199/transactions-with-ddd-and-repository-pattern-in-typescript-a-guide-to-good-implementation-part-2-da0af3e10901

## Zod

- Runtime Validation in TypeScript: Where Zod Ends — https://dev.to/gabrielanhaia/runtime-validation-in-typescript-where-zod-ends-and-the-type-system-begins-4e9e

## Enforcement / testing

- How We Enforce Architecture Boundaries at Scale (lastminute) — https://technology.lastminute.com/how-we-enforce-architecture-boundaries-at-scale-on-our-app/
- Dependency Cruiser: Restrict Imports — https://spin.atomicobject.com/dependency-cruiser-imports/
- Vitest Mocking — https://v3.vitest.dev/guide/mocking

Note: Palermo and Graça pages were read in full; the others come from search results and were not individually verified.

## Changelog

- 1.0.0 — initial: rules A–D, layer map, Fastify/Drizzle/Zod/testing references, dependency-cruiser template, review checklist.
