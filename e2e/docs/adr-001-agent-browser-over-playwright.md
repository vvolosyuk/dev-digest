# ADR-001: Use agent-browser (native CDP CLI), not Playwright

**Status:** Accepted

## Context

The web e2e suite needs to drive a real browser against the studio UI,
deterministically, without requiring Node-managed browser binaries or
introducing flakiness from AI-driven interactions.

## Decision

e2e is built on Vercel's `agent-browser` — a native (Rust + CDP)
browser-automation CLI, installed globally (`npm i -g agent-browser &&
agent-browser install`) rather than as a package dependency. `e2e/` itself
has no runtime deps beyond TypeScript + `tsx`; it drives the external CLI as
a subprocess.

## Alternatives considered

- **Playwright** — the default choice for most Node e2e suites; rejected for
  this starter in favor of a lighter, native CLI with a smaller footprint and
  no requirement to manage Playwright's own browser-download/versioning
  inside `node_modules`. Also keeps `e2e/`'s own dependency surface
  minimal — no browser automation library in `package.json` at all.
- **Cypress** — not adopted; similar reasoning to Playwright, plus
  agent-browser's CDP-native approach fit the "deterministic commands against
  a shared browser session" flow model better.

## Consequences

- Contributors need `agent-browser` installed globally as a prerequisite —
  it's not pulled in by `npm install`, so CI (`e2e-web.yml`) and local setup
  both need the explicit install step.
- No Playwright ecosystem tooling (trace viewer, codegen, parallel workers)
  is available; flows are hand-authored JSON (see
  [ADR-003](adr-003-json-flow-dsl.md)).
- Depending on an external CLI tool (versioning, availability) is a risk the
  team has accepted in exchange for the lighter footprint.
