/**
 * Characterization test for `GET /repos/:id/pulls`'s Score/Cost/Findings
 * per-PR aggregation (`pulls/routes.ts` ~lines 121-191) — written against the
 * CURRENT inline-in-route implementation, before it moves into
 * `PullsRepository`'s `aggregates.repo.ts` (see the improvement plan, Tier 0 /
 * item 5). `server/INSIGHTS.md` flags this logic as untested today; this
 * locks down the exact behavior so the extraction can be verified not to
 * change it. Findings tally is already covered in `integration.it.test.ts` —
 * this file adds the two gaps: Score (latest-review-wins) and Cost (summed
 * across all runs).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[pulls-aggregates] Docker not available — skipping.');
}

d('GET /repos/:id/pulls — Score/Cost aggregation (characterization)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function setup() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient({
          pulls: [
            {
              number: 4201,
              title: 'PR under test',
              author: 'marisa.koch',
              branch: 'feat/agg-a',
              base: 'main',
              head_sha: 'sha4201',
              additions: 10,
              deletions: 2,
              files_count: 1,
              status: 'open',
              opened_at: '2026-06-01T00:00:00Z',
              updated_at: '2026-06-01T03:00:00Z',
            },
            {
              number: 4202,
              title: 'PR with no runs/reviews',
              author: 'marisa.koch',
              branch: 'feat/agg-b',
              base: 'main',
              head_sha: 'sha4202',
              additions: 3,
              deletions: 1,
              files_count: 1,
              status: 'open',
              opened_at: '2026-06-01T00:00:00Z',
              updated_at: '2026-06-01T03:00:00Z',
            },
          ],
        }),
      },
    });

    const createRepo = await app.inject({
      method: 'POST',
      url: '/repos',
      payload: { url: 'https://github.com/acme/pulls-aggregates-test' },
    });
    const repoId = createRepo.json().id;
    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    const rows = list.json() as { number: number; id: string }[];
    const prId = rows.find((r) => r.number === 4201)!.id;
    const prIdNoRuns = rows.find((r) => r.number === 4202)!.id;
    return { app, repoId, prId, prIdNoRuns };
  }

  it('score: the most recently created `kind=review` row wins, not the first or highest', async () => {
    const { app, repoId, prId } = await setup();
    const { workspaceId } = await seed(pg.handle.db);
    const base = { workspaceId, prId, kind: 'review' as const };

    // Oldest, highest score — must NOT win.
    await pg.handle.db
      .insert(t.reviews)
      .values({ ...base, score: 95, createdAt: new Date('2026-06-01T10:00:00Z') });
    // Middle.
    await pg.handle.db
      .insert(t.reviews)
      .values({ ...base, score: 40, createdAt: new Date('2026-06-01T11:00:00Z') });
    // Newest, lowest score — must win (latest-review-wins, not max-score).
    await pg.handle.db
      .insert(t.reviews)
      .values({ ...base, score: 10, createdAt: new Date('2026-06-01T12:00:00Z') });
    // A `kind=summary` row newer than all reviews — must be ignored (query
    // filters `kind='review'`).
    await pg.handle.db.insert(t.reviews).values({
      workspaceId,
      prId,
      kind: 'summary',
      score: 99,
      createdAt: new Date('2026-06-01T13:00:00Z'),
    });

    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    const row = (list.json() as { id: string; score: number | null }[]).find((p) => p.id === prId);
    expect(row?.score).toBe(10);
    await app.close();
  });

  it('score: null when the PR has no `kind=review` rows', async () => {
    const { app, prIdNoRuns, repoId } = await setup();
    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    const row = (list.json() as { id: string; score: number | null }[]).find(
      (p) => p.id === prIdNoRuns,
    );
    expect(row?.score).toBeNull();
    await app.close();
  });

  it('cost_usd: summed across every agent_run on the PR, across all agents/runs', async () => {
    const { app, repoId, prId } = await setup();
    const { workspaceId } = await seed(pg.handle.db);
    await pg.handle.db.insert(t.agentRuns).values([
      { workspaceId, prId, costUsd: 0.12, status: 'done' },
      { workspaceId, prId, costUsd: 0.34, status: 'done' },
      { workspaceId, prId, costUsd: null, status: 'failed' },
    ]);

    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    const row = (list.json() as { id: string; cost_usd: number | null }[]).find(
      (p) => p.id === prId,
    );
    expect(row?.cost_usd).toBeCloseTo(0.46, 5);
    await app.close();
  });

  it('cost_usd: null when the PR has no agent_runs', async () => {
    const { app, prIdNoRuns, repoId } = await setup();
    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    const row = (list.json() as { id: string; cost_usd: number | null }[]).find(
      (p) => p.id === prIdNoRuns,
    );
    expect(row?.cost_usd).toBeNull();
    await app.close();
  });
});
