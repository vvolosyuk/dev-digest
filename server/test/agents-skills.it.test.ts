import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
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
  console.warn('[agents-skills] Docker not available — skipping integration tests.');
}

/**
 * L02 — agent ⇄ skill links: `PUT /agents/:id/skills` (full ordered set with a
 * per-link `enabled`), the legacy `POST` shapes, version bump + snapshot of the
 * ENABLED ids only, no-op → no bump, and `skill_count` on `GET /agents`.
 * Skills are inserted straight into the DB so this suite doesn't depend on the
 * skills module's HTTP surface.
 */
d('agent skill links (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  async function insertSkill(opts: { enabled?: boolean; ws?: string } = {}): Promise<string> {
    const [row] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: opts.ws ?? workspaceId,
        name: `skill-${seq++}`,
        description: 'Flag things worth flagging.',
        type: 'rubric',
        source: 'manual',
        body: 'Body of the rule.',
        enabled: opts.enabled ?? true,
      })
      .returning();
    return row!.id;
  }

  async function createAgent(app: Awaited<ReturnType<typeof makeApp>>): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: `Skilled Agent ${seq++}`,
        provider: 'openai',
        model: 'gpt-4o-mini',
        system_prompt: 'Review the diff.',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function versions(app: Awaited<ReturnType<typeof makeApp>>, agentId: string) {
    return (await app.inject({ method: 'GET', url: `/agents/${agentId}/versions` })).json() as {
      version: number;
      config: { skills: string[] };
    }[];
  }

  it('PUT stores the ordered set with per-link enabled; GET returns it', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [a, b, c] = [await insertSkill(), await insertSkill(), await insertSkill()];

    const put = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: {
        links: [
          { skill_id: c, enabled: true },
          { skill_id: a, enabled: false },
          { skill_id: b, enabled: true },
        ],
      },
    });
    expect(put.statusCode).toBe(200);
    const expected = [
      { agent_id: agentId, skill_id: c, order: 0, enabled: true },
      { agent_id: agentId, skill_id: a, order: 1, enabled: false },
      { agent_id: agentId, skill_id: b, order: 2, enabled: true },
    ];
    expect(put.json()).toEqual(expected);

    const get = await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual(expected);
    await app.close();
  });

  it('a change bumps the agent version; the snapshot holds only ENABLED ids in order', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [a, b] = [await insertSkill(), await insertSkill()];

    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: b, enabled: true }, { skill_id: a, enabled: false }] },
    });
    const agent = (await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json();
    expect(agent.version).toBe(2);

    const vs = await versions(app, agentId);
    expect(vs.map((v) => v.version)).toEqual([2, 1]);
    expect(vs[0]!.config.skills).toEqual([b]);
    expect(vs[1]!.config.skills).toEqual([]);

    // Toggling the disabled link on changes the effective set → v3.
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: b, enabled: true }, { skill_id: a, enabled: true }] },
    });
    const vs3 = await versions(app, agentId);
    expect(vs3[0]).toMatchObject({ version: 3, config: { skills: [b, a] } });

    // Reordering → v4.
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: a, enabled: true }, { skill_id: b, enabled: true }] },
    });
    const vs4 = await versions(app, agentId);
    expect(vs4[0]).toMatchObject({ version: 4, config: { skills: [a, b] } });
    await app.close();
  });

  it('a no-op PUT (same effective set) does not bump the version', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [a, b] = [await insertSkill(), await insertSkill()];
    const payload = { links: [{ skill_id: a, enabled: true }, { skill_id: b, enabled: false }] };

    await app.inject({ method: 'PUT', url: `/agents/${agentId}/skills`, payload });
    expect((await versions(app, agentId)).map((v) => v.version)).toEqual([2, 1]);

    const again = await app.inject({ method: 'PUT', url: `/agents/${agentId}/skills`, payload });
    expect(again.statusCode).toBe(200);
    expect((await versions(app, agentId)).map((v) => v.version)).toEqual([2, 1]);
    const agent = (await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json();
    expect(agent.version).toBe(2);
    await app.close();
  });

  it('legacy POST shapes stay compatible (skill_ids → all enabled; skill_id → append)', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [a, b, c] = [await insertSkill(), await insertSkill(), await insertSkill()];

    const set = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [b, a] },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toEqual([
      { agent_id: agentId, skill_id: b, order: 0, enabled: true },
      { agent_id: agentId, skill_id: a, order: 1, enabled: true },
    ]);

    const linked = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: c },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json().map((l: { skill_id: string }) => l.skill_id)).toEqual([b, a, c]);

    const vs = await versions(app, agentId);
    expect(vs[0]).toMatchObject({ version: 3, config: { skills: [b, a, c] } });
    await app.close();
  });

  it('rejects duplicates (422), unknown / foreign-workspace skills and unknown agents (404)', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const a = await insertSkill();
    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: `other-${seq++}` }).returning();
    const foreign = await insertSkill({ ws: otherWs!.id });
    const ghost = '00000000-0000-0000-0000-000000000000';

    const dup = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: a, enabled: true }, { skill_id: a, enabled: false }] },
    });
    expect(dup.statusCode).toBe(422);

    const cross = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { links: [{ skill_id: foreign, enabled: true }] },
    });
    expect(cross.statusCode).toBe(404);

    const unknown = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: ghost },
    });
    expect(unknown.statusCode).toBe(404);

    const noAgent = await app.inject({
      method: 'PUT',
      url: `/agents/${ghost}/skills`,
      payload: { links: [{ skill_id: a, enabled: true }] },
    });
    expect(noAgent.statusCode).toBe(404);

    // Nothing was linked by the rejected calls.
    expect((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json()).toEqual([]);
    expect((await versions(app, agentId)).map((v) => v.version)).toEqual([1]);
    await app.close();
  });

  it('GET /agents reports skill_count = links enabled AND skills globally enabled', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const on = await insertSkill();
    const on2 = await insertSkill();
    const linkOff = await insertSkill();
    const globalOff = await insertSkill({ enabled: false });

    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: {
        links: [
          { skill_id: on, enabled: true },
          { skill_id: linkOff, enabled: false },
          { skill_id: globalOff, enabled: true },
          { skill_id: on2, enabled: true },
        ],
      },
    });

    const list = (await app.inject({ method: 'GET', url: '/agents' })).json() as {
      id: string;
      skill_count: number;
    }[];
    expect(list.find((x) => x.id === agentId)!.skill_count).toBe(2);
    // Agents without links report 0 (not absent).
    expect(list.every((x) => typeof x.skill_count === 'number')).toBe(true);
    await app.close();
  });
});
