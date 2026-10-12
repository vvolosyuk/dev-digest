# Fastify 5 in the Onion (skill v1.0.0)

- Each module is a `FastifyPluginAsync` registered statically in `modules/index.ts`. Plugins are encapsulated by default (a DAG of contexts); use `fastify-plugin` only for cross-cutting infra that must be visible to the parent.
- The container is the DI mechanism. Routes obtain it via `getContext` (`modules/_shared/context.ts`); do not add `fastify.decorate` for business services.
- Routes are schema-first with `fastify-type-provider-zod`: `schema: { params, querystring, body, response }` → invalid input is 422 before the handler. Handler body: read validated input → call `service` → return.
- Route handler shape:

```ts
const plugin: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get('/agents/:id', { schema: { params: IdParams, response: { 200: AgentDto } } },
    async (req) => getContext(app).agents.get(req.params.id));  // service only
};
```

- Errors: services throw typed errors from `platform/errors.ts`; the central error handler maps them to HTTP. Routes don't build error responses by hand.
- Logging: Pino via Fastify (`req.log`); services get a logger through the container, never import a logger singleton.
- Cross-cutting (helmet, cors, rate-limit, SSE) stays in `app.ts` / `platform/`, not in modules.

Sources: see `sources.md` (Fastify Plugins, Encapsulation, Plugins Guide).
