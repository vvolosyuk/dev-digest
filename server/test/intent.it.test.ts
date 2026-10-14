import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Review } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import {
  MockEmbedder,
  MockGitClient,
  MockGitHubClient,
  MockLLMProvider,
  MockRepoDocReader,
  MockSecretsProvider,
} from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW: Review = { verdict: 'approve', summary: 'ok', score: 90, findings: [] };

const CLASSIFICATION = {
  intent: 'Adds rate limiting to the public API endpoints.',
  in_scope: ['limiter middleware'],
  out_of_scope: ['billing changes'],
  risk_areas: [{ label: 'Adds Redis round-trip per request', kind: 'performance' }],
  confidence: 'high',
};

let seq = 0;
async function setupPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `intent-api-${seq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 482,
      title: 'Add rate limiting',
      author: 'marisa.koch',
      branch: 'feat/rl',
      base: 'main',
      headSha: 'a1b2c3d4',
      additions: 1,
      deletions: 0,
      filesCount: 1,
      status: 'needs_review',
      body: 'Adds rate limiting to the public API. Closes #471. Plan: docs/plans/x.md',
    })
    .returning();
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/config.ts',
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  });
  await db.insert(t.prCommits).values({ prId: pr!.id, sha: 'a1b2c3d4', message: 'Add limiter', author: 'marisa.koch' });
  return { repo: repo!, pr: pr! };
}

d('intent layer (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  /** The same mock serves every provider id so the test is independent of the registry default. */
  function appWith(opts: { llm?: MockLLMProvider; intentProvidersMissing?: boolean } = {}) {
    const llm =
      opts.llm ??
      new MockLLMProvider('openai', {
        structuredBySchema: { Review: REVIEW, PrIntentClassification: CLASSIFICATION },
      });
    const reviewOnly = new MockLLMProvider('anthropic', { structuredBySchema: { Review: REVIEW } });
    return {
      llm,
      app: buildApp({
        config: config(),
        db: pg.handle.db,
        overrides: {
          secrets: new MockSecretsProvider({}),
          embedder: new MockEmbedder(),
          git: new MockGitClient({ diff: DIFF }),
          github: new MockGitHubClient(),
          repoDocs: new MockRepoDocReader({ 'docs/plans/x.md': '# Plan\nOut of scope: billing.' }),
          llm: opts.intentProvidersMissing
            ? { anthropic: reviewOnly }
            : { openai: llm, openrouter: llm, anthropic: llm },
        },
      }),
    };
  }

  const intentCalls = (llm: MockLLMProvider) =>
    llm.calls.filter(
      (c) => c.method === 'completeStructured' && (c.req as { schemaName: string }).schemaName === 'PrIntentClassification',
    ).length;

  async function createAgent(app: Awaited<ReturnType<typeof buildApp>>, provider: string, model: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: `A-${randomUUID().slice(0, 6)}`, provider, model, system_prompt: 'review' },
    });
    return res.json() as { id: string };
  }

  it('GET on a fresh PR returns no intent', async () => {
    const { app: appP } = appWith();
    const app = await appP;
    const { pr } = await setupPr(pg.handle.db, workspaceId);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.intent).toBeNull();
    expect(body.stale).toBe(false);
    expect(body.model).toEqual({ provider: expect.any(String), model: expect.any(String) });
    await app.close();
  });

  it('POST derives + persists the intent; GET reports stale only after the head moves', async () => {
    const { app: appP, llm } = appWith();
    const app = await appP;
    const { pr } = await setupPr(pg.handle.db, workspaceId);

    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/intent` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.stale).toBe(false);
    expect(body.intent).toMatchObject({
      intent: CLASSIFICATION.intent,
      in_scope: CLASSIFICATION.in_scope,
      out_of_scope: CLASSIFICATION.out_of_scope,
      confidence: 'high',
      head_sha: 'a1b2c3d4',
      cost_usd: 0.001,
      tokens_in: 100,
      tokens_out: 50,
    });
    expect(body.intent.computed_at).toEqual(expect.any(String));
    expect(body.intent.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'doc', ref: 'docs/plans/x.md', fetched: true }),
        expect.objectContaining({ kind: 'issue', ref: '#471', fetched: true }),
        expect.objectContaining({ kind: 'description', fetched: true }),
      ]),
    );
    expect(body.intent.risk_areas).toEqual([
      { label: 'Adds Redis round-trip per request', kind: 'performance', source: 'model' },
    ]);
    expect(intentCalls(llm)).toBe(1);

    const again = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` })).json();
    expect(again.stale).toBe(false);
    expect(again.intent.intent).toBe(CLASSIFICATION.intent);
    expect(intentCalls(llm)).toBe(1); // GET never calls the LLM

    await pg.handle.db.update(t.pullRequests).set({ headSha: 'b2c3d4e5' }).where(eq(t.pullRequests.id, pr.id));
    const moved = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` })).json();
    expect(moved.stale).toBe(true);
    expect(intentCalls(llm)).toBe(1);
    await app.close();
  });

  it('is workspace-scoped and validates the id', async () => {
    const { app: appP } = appWith();
    const app = await appP;
    const [other] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-ws' }).returning();
    const { pr } = await setupPr(pg.handle.db, other!.id);

    expect((await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/pulls/${pr.id}/intent` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/pulls/not-a-uuid/intent' })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/pulls/not-a-uuid/intent' })).statusCode).toBe(422);
    await app.close();
  });

  it('POST maps a missing provider key to intent_model_unavailable (400)', async () => {
    const { app: appP } = appWith({ intentProvidersMissing: true });
    const app = await appP;
    const { pr } = await setupPr(pg.handle.db, workspaceId);
    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/intent` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('intent_model_unavailable');
    await app.close();
  });

  it('a review run feeds the intent into the prompt and reuses it on an unchanged hash', async () => {
    const { app: appP, llm } = appWith();
    const app = await appP;
    const { pr } = await setupPr(pg.handle.db, workspaceId);
    const agent = await createAgent(app, 'openai', 'gpt-4.1');

    const first = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    expect(first.statusCode).toBe(200);
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const runId = first.json().runs[0].run_id;
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.prompt_assembly.user).toContain('derived-intent');
    expect(trace.prompt_assembly.user).toContain('Derived PR intent');
    expect(trace.log.some((l: { msg: string }) => l.msg.startsWith('Intent ready'))).toBe(true);
    expect(intentCalls(llm)).toBe(1);

    const second = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    expect(second.statusCode).toBe(200);
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 2 });
    expect(intentCalls(llm)).toBe(1); // cache hit: no new intent call
    await app.close();
  });

  it('a review still finishes when the intent provider is unavailable', async () => {
    const { app: appP } = appWith({ intentProvidersMissing: true });
    const app = await appP;
    const { pr } = await setupPr(pg.handle.db, workspaceId);
    const agent = await createAgent(app, 'anthropic', 'claude-sonnet-4-5');

    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    expect(res.statusCode).toBe(200);
    const runs = await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    expect(runs[0]!.status).toBe('done');
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runs[0]!.id}/trace` })).json();
    expect(trace.prompt_assembly.user).not.toContain('Derived PR intent');
    expect(trace.log.some((l: { msg: string }) => l.msg.startsWith('Intent unavailable'))).toBe(true);
    expect(trace.log.some((l: { kind: string }) => l.kind === 'error')).toBe(false);
    await app.close();
  });
});
