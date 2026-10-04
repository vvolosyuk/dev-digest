---
name: breaking-change
description: Flag removal, rename or narrowing of a public contract (exported symbol, function signature, request field, route, enum member, env/config key) that consumers rely on. Use when the diff deletes or edits an exported API, shared schema or route.
type: rubric
metadata:
  version: "0.1.0"
---

# Breaking change

A change is **breaking** if a consumer written against the previous version —
without touching its own code — now fails to compile, gets its input rejected,
or silently gets different behaviour. Judge from the consumer's side, never from
the size of the diff.

## Scope

- **This skill:** is the change breaking? Covers removals, renames, narrowed
  inputs, changed signatures and changed meaning.
- **Not this skill:** response shape details → `response-schema`; which version
  bump → `semver-discipline`; how to remove safely → `deprecation-policy`.

## Procedure

For every removed or edited line on a public surface:

1. **Name the contract** — export, route, schema field, enum, env key, CLI flag, stored format.
2. **Name the consumers** — other packages, the client, external callers, stored data.
   If all consumers live inside this diff and the contract is repo-internal, it is not breaking.
3. **Replay the old call** against the new code. Does it still compile, validate and mean the same thing?

## Red flags

1. Export, route, field, enum member or env key **removed or renamed**.
2. Input **narrowed**: optional → required, new required param, `.strict()` added,
   union member removed, limits tightened (`max(100)` → `max(50)`).
3. Function gains a **required parameter** or reorders positional ones.
4. **Meaning changes, name stays**: units (`s` → `ms`), inclusive → exclusive range,
   default value flipped.
5. Stored data (DB rows, files, queue messages) changes format with no migration.

**Not breaking:** new optional field/param, new export, widened input type,
loosened limit, new route.

## Bad / Good

**❌ Bad — rename removes the old export**

```ts
- export function getUser(id: string): Promise<User> { … }
+ export function fetchUser(id: string): Promise<User> { … }
```

Every `import { getUser }` stops compiling.

**✅ Good — new name, old one kept as a deprecated alias**

```ts
+ export function fetchUser(id: string): Promise<User> { … }
+ /** @deprecated Since 2.6.0. Use {@link fetchUser}. Removed in 3.0.0. */
+ export const getUser = fetchUser;
```

**❌ Bad — optional request field becomes required**

```ts
  const ListQuery = z.object({
-   limit: z.number().int().optional(),
+   limit: z.number().int(),
  });
```

Callers that omit `limit` now get `400`.

**✅ Good — keep it optional and give it a default**

```ts
  const ListQuery = z.object({
-   limit: z.number().int().optional(),
+   limit: z.number().int().default(20),
  });
```

**❌ Bad — same name, new unit**

```ts
- timeout: number; // seconds
+ timeout: number; // milliseconds
```

Old callers that pass `30` now get a 30 ms timeout, with no error to tell them.

**✅ Good — new name for the new meaning**

```ts
  /** @deprecated Use timeoutMs. */
  timeout?: number;   // seconds, still honoured
+ timeoutMs?: number;
```

## Severity

- **CRITICAL** — red flags 1–5 on a contract with consumers outside the diff and
  no compatibility path (alias, default, version, migration).
- **WARNING** — breaking, but every consumer is updated in the same diff and
  the contract is not published or deployed independently.
- **SUGGESTION** — additive change without a changelog note.

## Finding format

**❌ Bad finding:** "This might break clients."

**✅ Good finding:** "`ListQuery.limit` became required (`routes/reviews.ts:14`).
The web client's `useReviews()` and any external caller that omits `limit` now
get `400`. Keep it optional with `.default(20)`, or ship the change as `/v2/reviews`."

Cite the changed line, name the consumer and say exactly how it breaks, then
give one concrete compatible alternative.
