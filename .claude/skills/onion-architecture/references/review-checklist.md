# Review checklist (skill v1.0.0)

Run from repo root. Each command should print nothing for a clean module.

```bash
# D: routes must not touch DB/adapters directly (imports)
rg -n "from '(drizzle-orm|.*db/schema|.*adapters/)" server/src/modules/*/routes.ts
# D: routes must not use container.db / container.<adapter> directly
rg -n "container\.(db|github|llm|git|codeIndex|embedder|secrets|auth|tokenizer|depgraph)\b" server/src/modules/*/routes.ts
# C: services/helpers must not import fastify, drizzle, SDKs
rg -n "from '(fastify|drizzle-orm|openai|@anthropic-ai/sdk|octokit|simple-git)'" server/src/modules/*/service.ts server/src/modules/*/helpers.ts
# C: modules must not import each other
rg -n "from '\.\./(?!_shared)[a-z-]+/" server/src/modules --pcre2
# Row types leaking out of the repository
rg -n "\$inferSelect|db/rows" server/src/modules --glob '!**/repository*'
# Dependency graph
cd server && npx depcruise src --config ../.claude/skills/onion-architecture/templates/.dependency-cruiser.onion.cjs
```

## Known pre-existing violations (as of v1.0.0 — don't widen, fix when touching)

- `modules/pulls/routes.ts` — Drizzle + `container.db` inline (~22 `container.*` uses; delete/insert `prFiles`/`prCommits`, aggregates).
- `modules/settings/routes.ts` (8), `modules/polling/routes.ts` (4), `modules/workspace/routes.ts` (1) — direct `container.db`.
- `modules/settings/feature-models.ts`, `modules/repos/helpers.ts` — query/schema in helper files.
- `modules/reviews/run-executor.ts`, `diff-loader.ts`, `service.ts` — `$inferSelect` / `AgentRow` leak.
- `adapters/auth/local.ts` — imports constants from `db/seed.ts`.
- `modules/reviews/diff-loader.ts` → `adapters/git/diff-parser.ts`; `modules/repo-intel/service.ts` → `adapters/codeindex/extract.ts`, `adapters/astgrep` — service imports adapter internals instead of a port.
- `modules/repos/service.ts` → `modules/repo-intel/constants.ts`; `adapters/{depgraph,astgrep}` → `modules/repo-intel/constants.ts` — cross-layer/cross-module constants (move to `_shared/` or the port).

depcruise baseline at v1.0.0: 11 warnings, 0 errors.

Report format: `file:line — rule A|B|C|D — suggested fix`.
