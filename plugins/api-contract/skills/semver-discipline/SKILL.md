---
name: semver-discipline
description: Decide the required version bump (MAJOR/MINOR/PATCH) for a change to a published package or versioned API, and flag a declared bump that does not match. Use when the diff edits a version field, CHANGELOG or release notes, or a public contract of a versioned package or API.
type: convention
metadata:
  version: "0.1.0"
---

# Semver discipline

The bump is decided by the **most severe consumer-visible change** in the
release. Diff size, effort and the author's intent don't count. A version
number tells consumers whether upgrading is safe. A wrong number is a broken
promise, even when the code is correct.

## Scope

- **This skill:** which bump this change requires, and whether the declared bump,
  changelog and commit message match it.
- **Uses verdicts from:** `breaking-change` and `response-schema` (breaking →
  MAJOR), `deprecation-policy` (deprecate → MINOR, remove → MAJOR).
- **Skip** when nothing is versioned (an app with no published package and no
  versioned API). For HTTP APIs, "MAJOR" means a new route version (`/v2`).

## Decision table

| Change | Bump |
|---|---|
| Anything `breaking-change` / `response-schema` calls breaking | **MAJOR** |
| Removing a deprecated symbol, field, route or config key | **MAJOR** |
| Raising the minimum runtime (Node, browser) or a peer dependency's major | **MAJOR** |
| Changing a default that existing callers rely on | **MAJOR** |
| TS type change that breaks consumers' compile (narrowed param, widened return) | **MAJOR** |
| New export, optional field/param, route, or new input enum value | MINOR |
| Marking something `@deprecated` | MINOR |
| Bug fix restoring documented behaviour, internal refactor, perf, docs | PATCH |

**Edge cases**

- **`0.y.z`**: anything may change, but by convention a breaking change bumps
  `y` and everything else bumps `z`. Flag a breaking change shipped as `0.y.(z+1)`.
- **Bug fix people depend on**: if the "wrong" behaviour was documented or widely
  relied on, fixing it is MAJOR. Otherwise ship it behind a flag.
- **Type-only changes count.** A consumer whose `tsc` fails has been broken.
- **"Internal" is not an excuse** if the symbol is reachable from the package
  entry point or `exports` map.

## What must line up

1. `version` in `package.json` (or the API version in the route prefix or spec).
2. CHANGELOG entry under the right heading, with a **BREAKING CHANGES** section for MAJOR.
3. Commit / PR title: `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer for MAJOR.
4. Migration notes for every breaking item: what to change, old → new.

## Bad / Good

**❌ Bad — breaking change shipped as a patch**

```diff
- "version": "2.4.1"
+ "version": "2.4.2"
  // commit: fix(api): make limit required
```

Consumers on `^2.4.0` upgrade automatically and start getting `400`s.

**✅ Good — major bump with a migration note**

```diff
- "version": "2.4.1"
+ "version": "3.0.0"
  // commit: feat(api)!: require limit on list endpoints
  // CHANGELOG → ### BREAKING CHANGES
  //   - `limit` is now required on GET /reviews. Pass `limit=20` to keep old behaviour.
```

**❌ Bad — deprecated API removed in a minor**

```diff
  // 2.5.0
- /** @deprecated Use fetchUser. */
- export const getUser = fetchUser;
```

"It has been deprecated since 2.1" doesn't change the rule. Removal is MAJOR.

**✅ Good — removal waits for the next major**

```text
2.6.0  getUser marked @deprecated (MINOR)
3.0.0  getUser removed, listed under BREAKING CHANGES (MAJOR)
```

**❌ Bad — inflated bump**

```diff
- "version": "2.4.1"
+ "version": "3.0.0"
  // commit: feat: add optional `sort` param
```

Unnecessary majors teach consumers to pin versions and stop upgrading.

**✅ Good:** `2.5.0` — additive, MINOR.

## Severity

- **CRITICAL** — a breaking change released as MINOR or PATCH of a published
  package or versioned API.
- **WARNING** — MAJOR bump with no BREAKING CHANGES / migration notes; deprecated
  item removed outside a major; a bump larger than needed.
- **SUGGESTION** — MINOR/PATCH change with no changelog entry.

## Finding format

**❌ Bad finding:** "Consider bumping the version."

**✅ Good finding:** "`package.json` bumps 2.4.1 → 2.4.2, but `ListQuery.limit`
became required (`routes/reviews.ts:14`), which is breaking (see `breaking-change`).
Release as 3.0.0 with a BREAKING CHANGES note, or keep `limit` optional to stay
on 2.x."

State the required bump, the declared bump, the change that decides it, and the
two ways to make them agree.
