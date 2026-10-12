import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

/**
 * GET /repos/:id/pulls — Score + Cost aggregation.
 * Oracle: server/specs/run-cost.md (Decisions 1-2) and the route's Score
 * contract (latest `kind='review'` review per PR; null when none).
 */
const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const mkPr = (number: number) => ({
  number,
  title: `PR ${number}`,
  author: 'marisa.koch',
  branch: `feat/${number}`,
  base: 'main',
  head_sha: `sha${number}`,
  additions: 1,
  deletions: 1,
  files_count: 1,
  status: 'open' as const,
  opened_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T03:00:00Z',
});

type ListItem = { id: string; number: number; score: number | null; cost_usd: number | null };

d('GET /repos/:id/pulls — Score/Cost aggregation', () => {
  let pg: PgFixture;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId: string;
  let repoId: string;
  let byNumber: (n: number) => Promise<ListItem>;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient({
          pulls: [mkPr(9201), mkPr(9202), mkPr(9203), mkPr(9204), mkPr(9205)],
        }),
      },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/repos',
      payload: { url: 'https://github.com/acme/score-cost-test' },
    });
    repoId = created.json().id;
    byNumber = async (n) => {
      const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
      expect(res.statusCode).toBe(200);
      return (res.json() as ListItem[]).find((p) => p.number === n)!;
    };
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  it('returns null score and null cost_usd for a PR with no reviews or runs', async () => {
    const pr = await byNumber(9205);
    expect(pr.score).toBeNull();
    expect(pr.cost_usd).toBeNull();
  });

  it('sums cost_usd across every run on a PR (multi-agent) without leaking into other PRs', async () => {
    const { id: prA } = await byNumber(9201);
    const { id: prB } = await byNumber(9202);
    const db = pg.handle.db;
    await db.insert(t.agentRuns).values([
      { workspaceId, prId: prA, status: 'completed', costUsd: 0.001 },
      { workspaceId, prId: prA, status: 'completed', costUsd: 0.002 },
      { workspaceId, prId: prA, status: 'completed', costUsd: 0.004 },
      { workspaceId, prId: prB, status: 'completed', costUsd: 0.5 },
    ]);

    expect((await byNumber(9201)).cost_usd).toBeCloseTo(0.007, 10);
    expect((await byNumber(9202)).cost_usd).toBeCloseTo(0.5, 10);
  });

  it('counts a failed run (cost_usd 0) as zero and keeps the total of the other runs', async () => {
    const { id: prId } = await byNumber(9203);
    await pg.handle.db.insert(t.agentRuns).values([
      { workspaceId, prId, status: 'completed', costUsd: 0.25 },
      { workspaceId, prId, status: 'failed', costUsd: 0 },
    ]);
    expect((await byNumber(9203)).cost_usd).toBeCloseTo(0.25, 10);
  });

  it('returns 0 (not null) when the only run failed with cost_usd 0', async () => {
    const { id: prId } = await byNumber(9204);
    await pg.handle.db
      .insert(t.agentRuns)
      .values({ workspaceId, prId, status: 'failed', costUsd: 0 });
    expect((await byNumber(9204)).cost_usd).toBe(0);
  });

  it('does not inflate cost_usd when the PR also has several reviews and findings', async () => {
    const { id: prId } = await byNumber(9201);
    const before = (await byNumber(9201)).cost_usd;
    const db = pg.handle.db;
    const reviews = await db
      .insert(t.reviews)
      .values([
        { workspaceId, prId, kind: 'review', score: 70 },
        { workspaceId, prId, kind: 'review', score: 80 },
      ])
      .returning();
    for (const r of reviews) {
      await db.insert(t.findings).values(
        [1, 2, 3].map((n) => ({
          reviewId: r.id,
          file: 'a.ts',
          startLine: n,
          endLine: n,
          category: 'bug',
          title: 'x',
          rationale: 'y',
          confidence: 0.9,
          severity: 'WARNING' as const,
        })),
      );
    }
    expect((await byNumber(9201)).cost_usd).toBeCloseTo(before!, 10);
  });

  it('score is the latest kind=review review, ignoring older reviews and summaries', async () => {
    const { id: prId } = await byNumber(9202);
    await pg.handle.db.insert(t.reviews).values([
      { workspaceId, prId, kind: 'review', score: 40, createdAt: new Date('2026-06-01T00:00:00Z') },
      { workspaceId, prId, kind: 'review', score: 85, createdAt: new Date('2026-06-02T00:00:00Z') },
      // Newer but kind=summary → must not affect the score.
      { workspaceId, prId, kind: 'summary', score: 5, createdAt: new Date('2026-06-03T00:00:00Z') },
    ]);
    expect((await byNumber(9202)).score).toBe(85);
  });
});
