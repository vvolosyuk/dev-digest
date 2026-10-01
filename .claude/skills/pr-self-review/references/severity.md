# Severity scale

One scale for every skill: `CRITICAL > HIGH > MEDIUM > LOW`. Only `CRITICAL` makes the verdict `BLOCKED`.

## Where the level comes from

1. If the skill tags the rule itself, use that tag (`react-best-practices` has CRITICAL/HIGH/MEDIUM headings; `security` has a "Severity Classification" table; `zod` tags whole categories CRITICAL).
2. Otherwise use the mapping below.
3. A skill's own CRITICAL is only a *candidate*. It must pass the CRITICAL gate below, or it is reported as HIGH.

## Mapping for skills without their own scale

| Level | Examples |
|---|---|
| **CRITICAL** | Onion dependency-rule break **introduced by this diff**: a route touching `container.db`/adapters/`drizzle-orm`/SDKs (rule D); domain or service importing `fastify`/`drizzle-orm`/SDKs (rule C); adapter importing from `modules/**`; module → module import. Hardcoded secret or token. SQL built from user input. Missing auth/validation on an endpoint that takes user data. Edit or deletion of an existing migration. Edit of `vendor/**` is a warning, not a finding. |
| **HIGH** | Missing error handling on I/O; Drizzle row types (`$inferSelect`) leaking out of `repository.ts`; hand-rolled `Schema.parse(req.body)` instead of schema-first routes; transaction in a route; missing Fastify response/serialization schema; N+1 queries; effect/state misuse in React that causes bugs or loops; Next.js RSC boundary violations; pre-existing CRITICAL-class violation in a touched line the diff did not introduce. |
| **MEDIUM** | Maintainability: oversized component (>200 lines), too many props, naming/file-layout deviations, missing indexes on new columns, weak types (`any`) at internal boundaries. |
| **LOW** | Style, naming nits, test-quality suggestions. |

## CRITICAL gate (applies to every CRITICAL candidate)

A finding stays CRITICAL only if all hold:

1. **Introduced or widened by this diff.** The offending code is in an added/changed line (or is a new file). Pre-existing violations the diff merely sits next to are reported as HIGH with `preExisting: true` (the onion skill's "Known pre-existing violations" list is the reference: don't widen them, fix them in touched files).
2. **Concrete evidence.** The finding quotes the exact offending code (`evidence`) at a real `file:line`.
3. **Real consequence.** It states what breaks or what an attacker/caller can do (`why`), not just "violates a guideline".

A candidate failing any of the three is downgraded to HIGH and says why in `why`.

## Not findings

- Anything in excluded files (lock files, `server/clones/**`, migrations, vendored code) — they appear in the report as warnings only.
- Features intentionally absent in this course starter (later lessons in `README.md`'s lesson table).
