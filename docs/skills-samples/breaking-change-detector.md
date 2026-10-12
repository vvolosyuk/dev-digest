---
name: breaking-change-detector
description: Flag breaking changes to any public contract (exported types, DTOs, zod schemas, events, DB columns read by other services, env/config keys) and require a migration path. Use when the diff edits shared contracts or exported APIs.
type: custom
---

# Breaking-change detector

A public contract is anything another package, service, client, or stored data
depends on. Changing it without a migration path breaks code you cannot see in
this diff. Treat every contract edit as breaking until proven compatible.

## What counts as a public contract

- Exported TypeScript types/interfaces and function signatures from a package entry.
- zod schemas and DTOs shared between server and client (`contracts/`, `shared/`,
  `vendor/shared`).
- HTTP routes and their schemas (see also `route-signature-compat`).
- Event / webhook / SSE payloads and queue messages.
- DB columns, enum values and JSON shapes read by other code or already stored.
- Environment variables, config keys, CLI flags, file formats on disk.

## Red flags in a diff

1. A field, export, enum member, or env key is **removed or renamed**.
2. A type is **narrowed**: optional → required, `string | null` → `string`,
   union member removed, `max` lowered.
3. The **meaning** changes while the name stays: units (`seconds` → `ms`), currency
   minor/major units, inclusive → exclusive ranges, default value changed.
4. A function gains a **required parameter** or reorders positional parameters.
5. Serialized data changes shape but existing rows/messages/files are not migrated.
6. Only one copy of a duplicated contract is edited (server copy changed, client
   copy not — or vice versa).
7. A default is flipped (`enabled: true` → `false`) that changes behaviour for
   existing callers who never set it.

## Acceptable migration paths

- Additive change only (new optional field, new enum value handled by consumers).
- Accept old and new forms for a deprecation window; emit a warning on the old one.
- Version the contract (`v2` route / schema / event type) and keep v1 working.
- A data migration in the same diff that converts existing stored data.
- All consumers updated in the same diff AND the contract is internal to this repo.

## Security angle

- A loosened schema (validation removed, `.passthrough()`, `z.any()`) on input is a
  contract change that can open mass-assignment or injection — flag it.
- A response that now includes new fields can leak data (internal IDs, emails,
  tokens) to existing clients — check what was added to serialized output.

## Severity

- **CRITICAL** — red flags 1–5 on a contract with consumers outside the diff and no
  migration path; or a loosened input schema / widened response that exposes data.
- **WARNING** — red flags 6–7, or a breaking change whose consumers are all updated
  in the diff but with no deprecation window for deployed clients.
- **SUGGESTION** — missing changelog / deprecation note for an additive change.

## Finding format

Cite the contract line that changed. Rationale: who consumes it, what they rely on,
and how they break. Suggestion: the concrete migration path from the list above.
