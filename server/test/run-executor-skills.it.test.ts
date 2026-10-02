import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { Review, RunTrace } from '@devdigest/shared';

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

const EMPTY_REVIEW: Review = { verdict: 'approve', summary: 'ok', score: 100, findings: [] };

/** Deterministic tokenizer: 1 token per 4 chars (rounded up). */
const tokenizer = { count: (s: string) => Math.ceil(s.length / 4) };

/**
 * L02 — skills injection in the review run: active skills (link enabled AND
 * skill enabled) are rendered in link order into `## Skills / rules`, recorded
 * in `prompt_assembly.skills` with per-slot `tokens`, and announced in the
 * Live Log. Disabled ones (per link or globally) never reach the prompt.
 */
d('run-executor skills injection (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(llm: MockLLMProvider) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: llm },
        tokenizer,
      },
    });
  }

  async function setupPr() {
    const name = `skills-repo-${seq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 7,
        title: 'Add key',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'abc123',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    return pr!;
  }

  async function insertSkill(name: string, opts: { enabled?: boolean; version?: number } = {}) {
    const [row] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId,
        name: `${name}-${seq++}`,
        description: `Use when reviewing ${name}.`,
        type: 'convention',
        source: 'manual',
        body: `RULE ${name.toUpperCase()}: always check ${name}.`,
        enabled: opts.enabled ?? true,
        version: opts.version ?? 1,
      })
      .returning();
    return row!;
  }

  async function createAgent(app: Awaited<ReturnType<typeof makeApp>>, provider = 'openai') {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: `Skills Agent ${seq++}`, provider, model: 'gpt-4.1', system_prompt: 'sys' },
    });
    return res.json().id as string;
  }

  async function runAndTrace(app: Awaited<ReturnType<typeof makeApp>>, agentId: string) {
    const pr = await setupPr();
    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId } });
    expect(res.statusCode).toBe(200);
    const runId = res.json().runs[0].run_id as string;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json() as RunTrace;
    return { runId, trace };
  }

  it('injects active skills in link order; disabled (link or global) are absent; tokens + log', async () => {
    const llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW });
    const app = await makeApp(llm);
    const agentId = await createAgent(app);

    const second = await insertSkill('beta', { version: 3 });
    const first = await insertSkill('alpha');
    const linkOff = await insertSkill('gamma');
    const globalOff = await insertSkill('delta', { enabled: false });

    const put = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: {
        links: [
          { skill_id: first.id, enabled: true },
          { skill_id: linkOff.id, enabled: false },
          { skill_id: globalOff.id, enabled: true },
          { skill_id: second.id, enabled: true },
        ],
      },
    });
    expect(put.statusCode).toBe(200);

    const { runId, trace } = await runAndTrace(app, agentId);
    const [run] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId));
    expect(run!.status).toBe('done');

    const skills = trace.prompt_assembly.skills!;
    const expectedBlock =
      `### Skill: ${first.name} (convention, v1)\n${first.description}\n\n${first.body}` +
      `\n\n` +
      `### Skill: ${second.name} (convention, v3)\n${second.description}\n\n${second.body}`;
    expect(skills).toBe(expectedBlock);
    expect(skills).not.toContain('GAMMA');
    expect(skills).not.toContain('DELTA');

    // The same block actually reached the model, under `## Skills / rules`.
    const call = llm.calls.find((c) => c.method === 'completeStructured')!;
    const user = (call.req as { messages: { role: string; content: string }[] }).messages.find(
      (m) => m.role === 'user',
    )!.content;
    expect(user).toContain(`## Skills / rules\n${expectedBlock}`);

    // Per-slot token attribution.
    const tokens = trace.prompt_assembly.tokens!;
    expect(tokens.skills).toBe(tokenizer.count(expectedBlock));
    expect(tokens.skills).toBeGreaterThan(0);
    expect(tokens.system).toBeGreaterThan(0);
    expect(tokens.user).toBeGreaterThan(0);
    expect(tokens.memory).toBeUndefined();

    // Live Log line (persisted msg) + structured per-skill data on the bus.
    const line = trace.log.find((l) => l.msg.startsWith('Loaded 2 skills'));
    expect(line?.msg).toBe(
      `Loaded 2 skills: ${first.name}, ${second.name} (+${tokenizer.count(expectedBlock)} tokens)`,
    );
    const event = app.container.runBus.buffer(runId).find((e) => e.msg.startsWith('Loaded 2 skills'));
    const data = event!.data as { skills: { id: string; name: string; version: number; tokens: number }[] };
    expect(data.skills.map((s) => [s.id, s.name, s.version])).toEqual([
      [first.id, first.name, 1],
      [second.id, second.name, 3],
    ]);
    for (const s of data.skills) expect(s.tokens).toBeGreaterThan(0);
    expect(trace.log.some((l) => l.msg.includes(linkOff.name) || l.msg.includes(globalOff.name))).toBe(false);
    await app.close();
  });

  it('no active skills → no Skills section, no skills tokens, "No skills enabled" logged', async () => {
    const llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW });
    const app = await makeApp(llm);
    const agentId = await createAgent(app);
    const off = await insertSkill('epsilon');
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: off.id, enabled: false }] },
    });

    const { trace } = await runAndTrace(app, agentId);
    expect(trace.prompt_assembly.skills ?? null).toBeNull();
    expect(trace.prompt_assembly.tokens?.skills).toBeUndefined();
    expect(trace.prompt_assembly.user).not.toContain('## Skills / rules');
    expect(trace.log.some((l) => l.msg === 'No skills enabled')).toBe(true);
    await app.close();
  });

  it('fail-path trace still records the loaded skills block', async () => {
    const llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW });
    const app = await makeApp(llm);
    // Anthropic has no mock and no key → provider resolution fails the run
    // AFTER skills were loaded.
    const agentId = await createAgent(app, 'anthropic');
    const s = await insertSkill('zeta');
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: s.id, enabled: true }] },
    });

    const { runId, trace } = await runAndTrace(app, agentId);
    const [run] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId));
    expect(run!.status).toBe('failed');
    expect(trace.prompt_assembly.skills).toBe(
      `### Skill: ${s.name} (convention, v1)\n${s.description}\n\n${s.body}`,
    );
    expect(trace.prompt_assembly.tokens?.skills).toBeGreaterThan(0);
    await app.close();
  });
});
