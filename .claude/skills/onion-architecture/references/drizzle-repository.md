# Drizzle repository in the Onion (skill v1.0.0)

- Drizzle (`drizzle-orm@0.38`, driver `postgres`) is **Infrastructure**. Only `repository.ts`, `db/**`, and a few `platform/` infra files (e.g. `jobs.ts`) import it.
- One repository class per module: `class XRepository { constructor(private db: Db) {} }`; the service builds it from `container.db`.
- Methods are named after business intent (`findActiveByRepo`, `markReviewed`) not SQL shape (`selectWhere`).
- Return contract/domain types (from `@devdigest/shared`) — map rows inside the repository. Do not leak `typeof table.$inferSelect` or `db/rows.ts` types into services/routes/executors.
- Multi-statement writes (e.g. delete + insert of `prFiles`/`prCommits`) go in **one repository method** wrapped in `db.transaction(...)`.
- Aggregates/joins stay in the repository; services receive finished results.
- Schema: `db/schema/*.ts` split by domain; migrations only via `pnpm db:generate` (never edit existing ones).
- Integration test each data-backed workflow with `*.it.test.ts` + testcontainers Postgres.

Refactor recipe for a route that queries the DB (e.g. `pulls/routes.ts`): create `service.ts` + `repository.ts`, move queries verbatim into repository methods, move orchestration into the service, leave the route as validate → service → respond.
