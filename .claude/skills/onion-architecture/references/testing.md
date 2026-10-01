# Testing the Onion (skill v1.0.0)

| Layer | Test type | File | How |
|---|---|---|---|
| Domain (`reviewer-core`) | unit | `*.test.ts` colocated | pure inputs/outputs; fake `LLMProvider` |
| Application (service) | unit, hermetic | `server/test/*.test.ts` | build `Container` with `ContainerOverrides` / `src/adapters/mocks.ts` (`MockLLMProvider`, `MockGitClient`) |
| Infrastructure (repository) | integration | `*.it.test.ts` | real Postgres via testcontainers, `test/helpers/pg.ts` |
| Presentation | light | `app.inject()` | with mocked container; assert status/shape only |

- Prefer injected fakes over `vi.mock` of modules; reach for `vi.mock` only when an import is hard-wired.
- Any test importing `test/helpers/pg.ts` MUST end in `.it.test.ts`.
- Commands: unit `pnpm exec vitest run --exclude '**/*.it.test.ts'`; integration `pnpm exec vitest run .it.test` (Docker).
- Architecture test: run dependency-cruiser with `templates/.dependency-cruiser.onion.cjs` (see checklist).
