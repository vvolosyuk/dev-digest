# ADR-004: Ports-and-adapters behind a DI container for external integrations

**Status:** Accepted

## Context

`server/` talks to several external systems — an LLM provider, GitHub, local
git, ast-grep — that are expensive, non-deterministic, or require
credentials, all of which make them unsuitable to call directly from unit
tests.

## Decision

Every such integration is defined as a port (interface) with a production
adapter (`src/adapters/{llm,github,git,astgrep,...}`) and wired through a DI
container (`src/platform/container.ts`). Tests swap in mocks from
`src/adapters/mocks.ts` (`MockLLMProvider`, `MockGitClient`, etc.) instead of
hitting real services. `reviewer-core` itself only depends on an injected
`LLMProvider` interface, never a concrete SDK client.

## Alternatives considered

- **Import SDK clients (OpenAI/Anthropic/Octokit) directly into services** —
  rejected: makes services untestable without real network calls/keys, and
  couples business logic to a specific vendor SDK's shape.
- **A service-locator/singleton pattern instead of constructor-style DI** —
  rejected in favor of an explicit container so the wiring (prod adapters vs.
  mocks) is declared in one place (`container.ts`) rather than implied by
  import side effects.

## Consequences

- Unit tests run with zero external calls and no API keys (see
  `server-unit.yml` vs `server-integration.yml` split in `../../TESTING.md`).
- Adding a new external integration means adding a port + adapter + mock, not
  just an SDK import — slightly more ceremony for the safety.
- `reviewer-core` stays a pure engine (no DB/GitHub/filesystem access, per its
  own `AGENTS.md`) because the only side effect it's allowed is the injected
  `LLMProvider`.
