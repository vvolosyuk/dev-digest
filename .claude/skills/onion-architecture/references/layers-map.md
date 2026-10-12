# Layers map (skill v1.0.0)

| Layer | Where | May import | Must NOT import |
|---|---|---|---|
| Domain | `reviewer-core/src/**`, `@devdigest/shared` contracts + port interfaces | itself, `zod` | `fastify`, `drizzle-orm`, `server/**`, SDK clients (except `reviewer-core/src/llm/openrouter.ts`), fs/net |
| Application | `server/src/modules/*/service.ts`, `run-executor.ts`, `findings.ts`, pipelines | Domain, ports, own repository, `Container` type | `fastify`, `drizzle-orm`, `db/schema`, SDKs, other modules |
| Presentation | `server/src/modules/*/routes.ts` | own service, `_shared/*`, `zod`, contracts | `drizzle-orm`, `db/**`, `adapters/**`, SDKs, `container.<adapter|db>` |
| Infrastructure | `modules/*/repository.ts`, `src/adapters/**`, `src/db/**`, `platform/{jobs,sse,config,...}` | Domain/ports, `drizzle-orm`, SDKs | `modules/*/routes.ts`, `db/seed.ts` (from adapters) |
| Composition | `server/src/platform/container.ts`, `app.ts`, `modules/index.ts` | everything | — (keep logic-free) |

## Module shape

```
modules/<kebab>/
  routes.ts       # Fastify plugin, ZodTypeProvider, calls service only
  service.ts      # class XService { constructor(container: Container) }
  repository.ts   # class XRepository { constructor(private db: Db) }
  helpers.ts      # pure helpers (no db, no schema)
  constants.ts
```

Canonical example: `modules/agents/`.

## Cross-module sharing

Do not import `modules/B/*` from `modules/A/*`. Put the shared repo/service in `Container` (like `agentsRepo`, `reviewRepo` in `platform/container.ts`) or in `modules/_shared/`.
