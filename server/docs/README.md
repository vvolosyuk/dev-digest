# server docs

Design notes and ADRs for `@devdigest/api`. Read from `server/AGENTS.md` when relevant.

## ADRs

- [ADR-001: No monorepo/workspace tool — path aliases + vendoring](adr-001-no-monorepo-tool.md)
- [ADR-002: Migrations are never applied automatically on boot](adr-002-manual-migrations.md)
- [ADR-003: Store API keys/tokens in ~/.devdigest/secrets.json, not env-only](adr-003-local-secrets-file.md)
- [ADR-004: Ports-and-adapters behind a DI container for external integrations](adr-004-di-container-adapters.md)
- [ADR-005: Grounding gate is mandatory and mechanical, not model-trusted](adr-005-mandatory-grounding-gate.md)
- [ADR-006: Prompt-injection defense is one shared trusted-content rule](adr-006-prompt-injection-shared-rule.md)
- [ADR-007: Ship the full DB schema (including unused future-lesson tables) from migration 0000](adr-007-full-schema-upfront.md)
