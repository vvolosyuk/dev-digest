---
name: deprecation-policy
description: Require public APIs to be deprecated before removal — marked with a replacement and removal version, kept working, announced. Flag silent deletion or silent behaviour change of public symbols, fields, routes or config keys. Use when the diff removes or replaces a public contract.
type: convention
metadata:
  version: "0.1.0"
---

# Deprecation policy

Nothing public disappears silently. Removal takes three steps, in separate releases:

1. **Mark** it (MINOR): add a deprecation marker that names the replacement and the removal version.
2. **Keep it working** for the deprecation window. The old path delegates to the
   new one and warns once.
3. **Remove** it (MAJOR), only after the window ends, and list it under BREAKING CHANGES.

## Scope

- **This skill:** how to retire a contract safely, and whether a deprecation is complete.
- **Not this skill:** whether a change is breaking → `breaking-change` /
  `response-schema`; which bump → `semver-discipline`.

## A complete deprecation has

| Surface | Marker |
|---|---|
| TS export | `/** @deprecated Since X. Use {@link New}. Removed in Y. */` |
| Schema / OpenAPI | `deprecated: true`, or zod `.describe('Deprecated: use …')` |
| HTTP route | `Deprecation` header (RFC 9745), `Sunset` header (RFC 8594), `Link: <…>; rel="successor-version"` |
| Env / config key | Old key still read as a fallback, with a one-time warning naming the new key |
| Response field | Still populated with correct data until removal |
| Docs | CHANGELOG **Deprecated** section and a migration note |

Plus:

- **One implementation.** The old entry point delegates to the new one, so they
  can't drift apart.
- **Warn once** per process (`process.emitWarning(msg, 'DeprecationWarning')`
  behind a flag), not on every call.
- **Both paths are tested** until removal.

## Red flags

1. Public symbol, field, route or key **deleted with no prior deprecation release**.
2. `@deprecated` with **no replacement or no removal version**. Callers can't act on it.
3. The deprecated alias has its **own copy of the logic**.
4. A deprecated response field is **no longer populated** (`undefined`, `0`, `""`)
   while still in the schema. That is a silent removal.
5. Deprecated item removed **outside a MAJOR** release.
6. A deprecation warning that **fires on every call** and floods logs.

## Bad / Good

**❌ Bad — route deleted**

```ts
- app.get('/reviews/:id/comments', listComments);
+ app.get('/reviews/:id/threads', listThreads);
```

Existing clients get `404` with no warning.

**✅ Good — old route kept, delegating, with headers**

```ts
app.get('/reviews/:id/threads', listThreads);

/** @deprecated Since 2.6.0. Use GET /reviews/:id/threads. Removed in 3.0.0. */
app.get('/reviews/:id/comments', async (req, reply) => {
  reply
    .header('Deprecation', '@1790812800')                    // 2026-10-01
    .header('Sunset', 'Thu, 01 Apr 2027 00:00:00 GMT')
    .header('Link', `</reviews/${req.params.id}/threads>; rel="successor-version"`);
  return listThreads(req, reply);
});
```

**❌ Bad — marker that tells the caller nothing**

```ts
/** @deprecated */
export function getUser(id: string) { /* old copy of the logic */ }
```

**✅ Good — replacement, removal version, delegation**

```ts
/** @deprecated Since 2.6.0. Use {@link fetchUser}. Removed in 3.0.0. */
export const getUser = fetchUser;
```

**❌ Bad — env key renamed, old one silently ignored**

```ts
- const url = process.env.DB_URL;
+ const url = process.env.DATABASE_URL;
```

Deployments that still set `DB_URL` boot with `undefined`.

**✅ Good — fallback with a one-time warning**

```ts
const url = process.env.DATABASE_URL ?? deprecatedEnv('DB_URL', 'DATABASE_URL');
```

**❌ Bad — deprecated field quietly emptied**

```ts
- total: rows.length,
+ total: 0, // deprecated, use pageInfo.count
```

**✅ Good — keep it correct until removal**

```ts
  total: rows.length,             // @deprecated, use pageInfo.count; removed in 3.0.0
  pageInfo: { count: rows.length, next },
```

## Severity

- **CRITICAL** — red flag 1 or 4 on a contract with consumers outside the diff.
- **WARNING** — red flags 2, 3, 5 or 6; or a deprecation with no CHANGELOG entry.
- **SUGGESTION** — HTTP deprecation without `Sunset` / `Link` headers, or no test
  for the old path.

## Finding format

**❌ Bad finding:** "Don't delete this route."

**✅ Good finding:** "`GET /reviews/:id/comments` is removed (`routes/reviews.ts:40`)
with no prior deprecation release. Existing clients will get `404`. Keep the route,
delegate it to `listThreads`, add `Deprecation`/`Sunset` headers, and remove it in 3.0.0."

Name what was removed or changed, which deprecation step was skipped, and the
exact steps to restore the deprecation path.
