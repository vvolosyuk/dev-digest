# Zod at the boundary (skill v1.0.0)

- Schemas guard the perimeter; types guard the interior. Parse at the edge, infer the type, trust it inside.
- HTTP edge: route `schema` via `fastify-type-provider-zod` (no manual `.parse` in handlers). Response schemas serialize/strip output.
- Contracts live in `@devdigest/shared/contracts/*` (vendored). Derive types with `z.infer`; don't duplicate interfaces by hand.
- LLM output and other untrusted external data: validate in the adapter / `reviewer-core` (`parseWithRepair`, `groundFindings`) — never pass raw model output inward.
- Don't re-validate inside services for internal calls; validate again only when data crosses a new boundary (queue, file, env, third-party API).
- Config/env: parsed once in `platform/config.ts`, injected via `container.config`; nothing reads `process.env` elsewhere (secrets: `~/.devdigest/secrets.json` first).
