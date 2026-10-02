---
name: route-signature-compat
description: Flag HTTP route changes that existing clients cannot survive: renamed or removed params, newly required fields, changed methods or paths, changed response shapes or status codes. Use when the diff touches routes or their schemas.
type: rubric
---

# Route signature compatibility

Review every changed route as if you were a client compiled against the previous
version. If that client's request is now rejected, or it misreads the response,
the change is breaking.

## Step 1 — collect the changed routes

For each route registration or route schema in the diff, note before → after for:
method, path, path params, query params, request body, response body per status
code, error shape, and auth requirements.

## Step 2 — request side (what the client sends)

| Change | Breaking? |
|---|---|
| Path or method changed, old one removed | **Yes** |
| Path param renamed (`/users/:id` → `/users/:userId`) with handler reading the new name | Yes, if the URL template changes for clients |
| Query/body field renamed (`limit` → `pageSize`) | **Yes** — old field is ignored or rejected |
| Optional field made required (`.optional()` removed, added to `required`) | **Yes** |
| New required field added | **Yes** |
| Field type narrowed (`string` → `enum`, `number` → `int`, shorter `max`) | **Yes** for values now rejected |
| Unknown keys now rejected (`.strict()` added) | **Yes** |
| New optional field, widened type, loosened limit | No |

## Step 3 — response side (what the client reads)

| Change | Breaking? |
|---|---|
| Field removed or renamed (`total` → `count`) | **Yes** |
| Field type changed (`number` → `string`, object → array) | **Yes** |
| Field became nullable or optional | **Yes** — clients dereference it |
| Wrapping changed (`[...]` → `{ items: [...] }`, or unwrapped) | **Yes** |
| Enum value removed or renamed | **Yes**; new value added — Warning (exhaustive switches) |
| Success status code changed (`200` → `201` / `204`) | **Yes** for strict clients |
| Error status or error body shape changed | **Yes** |
| New optional field added | No |

## Step 4 — check the other side

- If the repo has a shared contract copy (e.g. `vendor/shared` in both server and
  client), the change must appear in both copies identically.
- If a client call site is in the diff, check it was updated to the new signature.
- Versioned routes (`/v2/...`) or a kept old alias make a change non-breaking.

## Severity

- **CRITICAL** — any "Yes" above on a route consumed outside this diff, with no
  compatibility path (no alias, no fallback to the old field, no version bump).
- **WARNING** — breaking in theory but every consumer is updated in the same diff,
  or a new enum value that exhaustive clients may not handle.
- **SUGGESTION** — undocumented additive change, missing deprecation note.

## Finding format

Cite the changed schema or handler line. Rationale: the old request/response, the
new one, and what an old client experiences (400, `undefined`, wrong total). Suggestion:
a compatible alternative — accept both names, keep the old field, version the route.
