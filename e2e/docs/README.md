# e2e docs

Design notes and ADRs for `@devdigest/e2e`. Read from `e2e/CLAUDE.md` when relevant.

## ADRs

- [ADR-001: Use agent-browser (native CDP CLI), not Playwright](adr-001-agent-browser-over-playwright.md)
- [ADR-002: Ban the AI `chat` locator — deterministic locators only](adr-002-deterministic-locators-only.md)
- [ADR-003: Flows are declarative JSON commands, not a test framework](adr-003-json-flow-dsl.md)
- [ADR-004: Run e2e against an isolated, ephemeral stack, not the shared dev stack](adr-004-hermetic-stack-isolation.md)
- [ADR-005: Flows only exercise read-only seeded data — never trigger an LLM call](adr-005-read-only-seeded-flows.md)
