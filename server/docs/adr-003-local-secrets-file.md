# ADR-003: Store API keys/tokens in ~/.devdigest/secrets.json, not env-only

**Status:** Accepted

## Context

DevDigest is local-first: it needs an LLM provider key and a GitHub token,
settable either via `.env` or through the Settings UI at runtime, so a user
doesn't have to restart the server or edit files to add a key. Nothing
should ever be persisted to git or the database.

## Decision

Secrets live in `~/.devdigest/secrets.json` (file mode `0600`), written when
a key is entered in Settings, with `process.env` as a fallback when the file
doesn't have a value. All secret reads funnel through one chokepoint,
`LocalSecretsProvider` (`src/adapters/secrets/local.ts`), rather than being
read from `process.env` ad hoc throughout the codebase. `loadConfig` marks
every secret optional so the server boots with zero keys configured.

## Alternatives considered

- **Env-vars only (`.env`, `process.env`)** — rejected as the sole mechanism:
  would force a server restart (or at least a re-read of `.env`) every time a
  user changes a key via Settings, which conflicts with "no keys required to
  boot, add them at runtime."
- **A cloud/managed secrets vault** — rejected: DevDigest runs entirely on
  the host machine with only Postgres in Docker; a vault is infrastructure
  the local-first course starter deliberately avoids.
- **Storing keys in Postgres** — rejected: secrets should never be in the
  database (or git), stated explicitly in the top-level `CLAUDE.md`.

## Consequences

- Keys survive server restarts without living in `.env`, and Settings-entered
  keys take effect without a restart.
- Anyone auditing "where do secrets come from" only has one file to check:
  `local.ts`.
- File permissions (`0600`) matter on the host OS; this guarantee is weaker
  on filesystems that don't enforce Unix permissions.
