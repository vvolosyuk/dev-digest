---
name: onion-architecture
description: Enforces Onion Architecture in DevDigest backend modules (Fastify 5 + Drizzle + Zod + reviewer-core). Use when creating, changing or reviewing anything in server/src/modules, server/src/adapters, server/src/platform or reviewer-core — routes, services, repositories, ports, the DI container. Triggers on "onion", "layers", "dependency rule", "repository", "service layer", "adapter", "new module", "route calls db".
version: 1.0.0
metadata:
  tested-with: "fastify@5.2, fastify-type-provider-zod@4, zod@3.24, drizzle-orm@0.38, drizzle-kit@0.30, postgres@3.4, vitest@2.1, dependency-cruiser@17.4"
---

# Onion Architecture — DevDigest backend (v1.0.0)

Dependencies point **inward only**. The center knows nothing about HTTP, SQL or SDKs.

```
 Presentation  routes.ts              Fastify + Zod schemas, HTTP mapping only
      │ calls
 Application   service.ts             use cases; gets everything from Container
      │ calls
 Domain        reviewer-core, @devdigest/shared contracts/ports   pure, no I/O
      ▲ implemented by
 Infrastructure repository.ts, src/adapters/**, src/db/**, platform/*
 Composition   platform/container.ts  the ONLY place implementations are wired
```

## A. Layers: route → service → domain, wired through the container

- A route gets its service via `getContext` / `container` (`modules/_shared/context.ts`) and calls **only** `service.method()`.
- A service takes `Container` (or ports) in its constructor, builds its repository from `container.db`, and calls domain code (`reviewer-core`, `@devdigest/shared` contracts).
- Domain code is pure: no `fastify`, `drizzle-orm`, SDKs, `process.env`, fs, network.
- New module = `src/modules/<kebab>/{routes,service,repository}.ts` (+ optional `helpers.ts`, `constants.ts`) and one entry in `modules/index.ts`.

## B. External integrations live in adapters at the edge

- LLM, GitHub, git, ast-grep, embedder, tokenizer, secrets, auth → `src/adapters/**`, implementing a port from `@devdigest/shared` (`vendor/shared/adapters.ts`).
- Wired only in `platform/container.ts`; tests swap them via `ContainerOverrides` / `src/adapters/mocks.ts`.
- New port → define it at the source lesson (do **not** edit `src/vendor/shared` ad hoc), then implement in `adapters/`.
- Adapters never import from `modules/**` or `db/seed.ts`.

## C. Dependencies point inward

Allowed: `routes → service → repository-interface/ports → domain`; `repository/adapters → ports/domain`; `container → everything`.
Forbidden: domain → anything outer; service → `fastify`; service/route → SDK (`openai`, `@anthropic-ai/sdk`, `octokit`, `simple-git`); module A → module B (share via `container` or `modules/_shared/`).

## D. A route must never call an adapter (or the DB) directly

Forbidden in `routes.ts`:
- importing `adapters/**`, `drizzle-orm`, `db/schema`, any SDK;
- touching `container.db`, `container.github`, `container.llm`, `container.git`, `container.codeIndex`, `container.embedder`, `container.secrets`, … directly.

If a route needs an integration or a query → add a method to the service (which calls the port/repository). No exceptions.

## Supporting rules

1. **Validation at the edge**: schema-first via `fastify-type-provider-zod`; no hand-rolled `Schema.parse(req.body)`. Inside, trust `z.infer` types.
2. **Drizzle types stay in `repository.ts`**: no `$inferSelect` / `*Row` outside it; map rows to contract/domain types.
3. **Repository speaks business language** (`findActiveByRepo`), one class per module taking `Db`; transactions live in the repository, never in a route.
4. **No singletons/globals**; dependencies arrive via constructor.
5. **Tests**: services unit-tested with fake ports (`*.test.ts`, hermetic); repositories with real Postgres (`*.it.test.ts`).
6. Do not edit `src/db/migrations/**`, `src/vendor/shared`, lock files.

## Workflow

1. Identify layer(s) the change touches; place code per the diagram above.
2. Write/modify code; keep imports inward.
3. Run the checks in `references/review-checklist.md` (grep for rule D + dependency-cruiser template).
4. When reviewing, report violations as `file:line — rule A/B/C/D — fix`. Known pre-existing violations are listed in the checklist; don't widen them, and fix those in files you touch.

## References

- `references/layers-map.md` — layer → folder → allowed imports
- `references/fastify.md`, `references/drizzle-repository.md`, `references/zod-boundaries.md`, `references/testing.md`
- `references/review-checklist.md` — grep checks + known violations
- `references/sources.md` — articles, links, versions, changelog
- `templates/.dependency-cruiser.onion.cjs` — forbidden-rules config
