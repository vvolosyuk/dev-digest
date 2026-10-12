---
name: response-schema
description: Flag changes to the shape of an API response — field types, required to optional, nullability, enum values, array/object wrapping, status codes, error bodies, newly exposed fields. Use when the diff edits a response schema, serializer, DTO mapper or a handler's return value.
type: rubric
metadata:
  version: "0.1.0"
---

# Response schema

A response is a promise that clients **read**. A client relies on each field
being present, having its type, being non-null, using a known enum value, being
nested where it was, and arriving with the expected status code. A response may
only get **richer** (new optional fields). It must never get **poorer** or
**looser**.

## Scope

- **This skill:** the response side only — what a client receives.
- **Not this skill:** request fields, exports and routes → `breaking-change`;
  version bump → `semver-discipline`; retiring a field → `deprecation-policy`.

## Request vs response are asymmetric

| Change | On a request | On a response |
|---|---|---|
| Field made optional / nullable | safe | **breaking** — clients dereference it |
| New required field | **breaking** | safe |
| Type widened (`'a'\|'b'` → `string`) | safe | **breaking** — exhaustive handling fails |
| New enum value | safe | **warning** — `switch` without `default` |

Don't reuse a request-side verdict for a response.

## Where response shape changes hide

- Response schemas (zod, JSON Schema, Fastify `schema.response`, OpenAPI).
- DTO mappers / serializers (`toDto`, `serialize`, `toJSON`).
- ORM `select` lists — dropping a column from `select` drops the field.
- The literal object the handler returns, when there is no response schema.
- Error handlers — the error body is part of the response.

## Red flags

1. Field **removed or renamed** (`total` → `count`).
2. Field **type changed** (`number` → `string`, object → array, date string → epoch).
3. Field became **optional or nullable**.
4. **Wrapping changed**: `[...]` → `{ items: [...] }`, or the reverse.
5. Enum value **removed or renamed**; a new value added (WARNING).
6. Success or error **status code**, or error body shape, changed.
7. **New field exposes data** — internal IDs, emails, tokens, hashes — because
   a whole entity is returned instead of a projection.

## Bad / Good

**❌ Bad — required field becomes nullable**

```ts
  const Review = z.object({
-   reviewer: User,
+   reviewer: User.nullable(),
  });
```

`review.reviewer.name` now throws in every existing client.

**✅ Good — keep the old field's guarantee, add the new state alongside**

```ts
  const Review = z.object({
    reviewer: User,                                   // still always set
+   assignment: z.enum(['assigned', 'auto', 'none']), // new, additive
  });
```

If `null` is genuinely needed, ship it in a new field or a new route version.

**❌ Bad — list gets wrapped for pagination**

```ts
- response: { 200: z.array(Item) }
+ response: { 200: z.object({ items: z.array(Item), next: z.string().nullable() }) }
```

`res.data.map(...)` fails: `map` is not a function.

**✅ Good — opt in to the new shape**

```ts
  // GET /items           → Item[]  (unchanged)
  // GET /v2/items        → { items, next }
```

Alternatively, send the cursor in a `Link` header and keep the body an array.

**❌ Bad — whole entity returned**

```ts
- return { id: user.id, name: user.name };
+ return user; // now includes passwordHash, email, internalNotes
```

**✅ Good — explicit projection backed by a response schema**

```ts
  return UserDto.parse({ id: user.id, name: user.name, avatarUrl: user.avatarUrl });
```

## Severity

- **CRITICAL** — red flags 1–4 or 6 on a response consumed outside this diff,
  with no versioning; or red flag 7 (data exposure), regardless of consumers.
- **WARNING** — red flag 5 (new enum value), or a breaking change whose consumers
  are all updated in the same diff.
- **SUGGESTION** — a handler returns data with no response schema at all.

## Finding format

**❌ Bad finding:** "Response changed, please check."

**✅ Good finding:** "`Review.reviewer` is now nullable (`schemas/review.ts:22`).
The client's `ReviewHeader` reads `review.reviewer.name` and will throw on
unassigned reviews. Keep `reviewer` non-null and add `assignment` as a new field."

Give the before → after shape, the client line that reads it, what fails at
runtime, and the compatible alternative.
