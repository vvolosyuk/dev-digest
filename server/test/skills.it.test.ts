import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import type { FastifyInstance } from 'fastify';
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
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * L02 skills module over real Postgres: CRUD, 409 on duplicate names,
 * versioning (config change bumps, enabled-only doesn't), restore → new
 * version, delete reports unlinked agents, list agent_count, import preview.
 */
d('skills module', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let n = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  const body = (over: Record<string, unknown> = {}) => ({
    name: `skill-${++n}`,
    description: 'Flag untested branches in changed code.',
    type: 'rubric',
    body: '- Every new branch needs a test.',
    ...over,
  });

  async function create(over: Record<string, unknown> = {}) {
    const res = await app.inject({ method: 'POST', url: '/skills', payload: body(over) });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  async function linkAgents(skillId: string, count: number) {
    const { db } = pg.handle;
    const [ws] = await db.select({ id: t.workspaces.id }).from(t.workspaces).limit(1);
    for (let i = 0; i < count; i++) {
      const [agent] = await db
        .insert(t.agents)
        .values({
          workspaceId: ws!.id,
          name: `Linker ${n}-${i}`,
          provider: 'openai',
          model: 'gpt-4o-mini',
          systemPrompt: 'x',
        })
        .returning();
      await db.insert(t.agentSkills).values({ agentId: agent!.id, skillId, order: 0 });
    }
  }

  it('creates a skill at v1 with a v1 snapshot; GET returns it', async () => {
    const created = await create();
    expect(created).toMatchObject({
      version: 1,
      source: 'manual',
      enabled: true,
      type: 'rubric',
      agent_count: 0,
    });
    expect(typeof created.updated_at).toBe('string');

    const got = await app.inject({ method: 'GET', url: `/skills/${created.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json()).toMatchObject({ id: created.id, name: created.name });

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${created.id}/versions` })
    ).json();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      skill_id: created.id,
      version: 1,
      name: created.name,
      body: created.body,
      note: null,
    });
  });

  it('accepts source imported_url and rejects other sources / invalid fields (422)', async () => {
    expect((await create({ source: 'imported_url' })).source).toBe('imported_url');
    for (const bad of [
      { source: 'community' },
      { name: 'Bad Name' },
      { name: 'x' },
      { description: 'short' },
      { type: 'nope' },
      { body: '' },
    ]) {
      const res = await app.inject({ method: 'POST', url: '/skills', payload: body(bad) });
      expect(res.statusCode, JSON.stringify(bad)).toBe(422);
    }
  });

  it('409 on a duplicate name (create and rename)', async () => {
    const a = await create();
    const dup = await app.inject({ method: 'POST', url: '/skills', payload: body({ name: a.name }) });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('conflict');

    const b = await create();
    const rename = await app.inject({
      method: 'PUT',
      url: `/skills/${b.id}`,
      payload: { name: a.name },
    });
    expect(rename.statusCode).toBe(409);
  });

  it('a body change bumps the version and snapshots it with the note', async () => {
    const s = await create();
    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${s.id}`,
      payload: { body: 'Tightened.', note: 'Tightened scope rule' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ version: 2, body: 'Tightened.' });
    expect(Date.parse(res.json().updated_at)).toBeGreaterThanOrEqual(Date.parse(s.updated_at));

    const versions = (await app.inject({ method: 'GET', url: `/skills/${s.id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0]).toMatchObject({ body: 'Tightened.', note: 'Tightened scope rule' });

    const v1 = await app.inject({ method: 'GET', url: `/skills/${s.id}/versions/1` });
    expect(v1.statusCode).toBe(200);
    expect(v1.json().body).toBe(s.body);
  });

  it('toggling enabled (or re-sending identical values) does not version', async () => {
    const s = await create();
    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${s.id}`,
      payload: { enabled: false, body: s.body },
    });
    expect(res.json()).toMatchObject({ version: 1, enabled: false });
    const versions = (await app.inject({ method: 'GET', url: `/skills/${s.id}/versions` })).json();
    expect(versions).toHaveLength(1);
  });

  it('restore creates a NEW version with the old content', async () => {
    const s = await create();
    await app.inject({
      method: 'PUT',
      url: `/skills/${s.id}`,
      payload: { body: 'v2 body', type: 'security' },
    });
    const res = await app.inject({ method: 'POST', url: `/skills/${s.id}/versions/1/restore` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ version: 3, body: s.body, type: 'rubric' });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${s.id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    expect(versions[0].note).toBe('Restored from v1');

    const missing = await app.inject({ method: 'POST', url: `/skills/${s.id}/versions/9/restore` });
    expect(missing.statusCode).toBe(404);
  });

  it('list includes agent_count, supports ?q=, and /agents lists linkers', async () => {
    const s = await create({ description: 'Flag zebra-striped corner cases always.' });
    await linkAgents(s.id, 2);

    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.find((x: { id: string }) => x.id === s.id).agent_count).toBe(2);

    const found = (await app.inject({ method: 'GET', url: '/skills?q=ZEBRA' })).json();
    expect(found.map((x: { id: string }) => x.id)).toEqual([s.id]);
    const none = (await app.inject({ method: 'GET', url: '/skills?q=%25%25' })).json();
    expect(none).toEqual([]);

    const agents = (await app.inject({ method: 'GET', url: `/skills/${s.id}/agents` })).json();
    expect(agents).toHaveLength(2);
    expect(Object.keys(agents[0]).sort()).toEqual(['id', 'name']);
  });

  it('DELETE returns the number of unlinked agents, then 404s', async () => {
    const s = await create();
    await linkAgents(s.id, 3);
    const res = await app.inject({ method: 'DELETE', url: `/skills/${s.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, unlinked_agents: 3 });
    expect((await app.inject({ method: 'GET', url: `/skills/${s.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${s.id}` })).statusCode).toBe(404);
  });

  it('404 for unknown ids and skills in another workspace', async () => {
    const ghost = '00000000-0000-0000-0000-000000000000';
    for (const url of [`/skills/${ghost}`, `/skills/${ghost}/versions`, `/skills/${ghost}/agents`]) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    }
    const { db } = pg.handle;
    const [other] = await db.insert(t.workspaces).values({ name: 'other-skills' }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({
        workspaceId: other!.id,
        name: 'foreign-skill',
        description: 'Not yours to read at all.',
        type: 'custom',
        source: 'manual',
        body: 'x',
      })
      .returning();
    expect((await app.inject({ method: 'GET', url: `/skills/${foreign!.id}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'PUT', url: `/skills/${foreign!.id}`, payload: { enabled: false } }))
        .statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${foreign!.id}` })).statusCode).toBe(404);
  });

  it('legacy version rows without name/description/type fall back to the skill', async () => {
    const s = await create();
    await pg.handle.db
      .insert(t.skillVersions)
      .values({ skillId: s.id, version: 7, body: 'legacy body' });
    const v = (await app.inject({ method: 'GET', url: `/skills/${s.id}/versions/7` })).json();
    expect(v).toMatchObject({ name: s.name, description: s.description, type: s.type, body: 'legacy body' });
  });

  describe('POST /skills/import/preview', () => {
    const b64 = (u8: Uint8Array) => Buffer.from(u8).toString('base64');
    const preview = (filename: string, bytes: Uint8Array) =>
      app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        payload: { filename, content_base64: b64(bytes) },
      });

    it('previews a zip, reports conflict, and persists nothing', async () => {
      const existing = await create();
      const before = (await app.inject({ method: 'GET', url: '/skills' })).json().length;
      const skillMd = `---\nname: ${existing.name}\ndescription: Flag flaky timing in tests.\n---\nBody`;
      const zip = zipSync({ 'SKILL.md': strToU8(skillMd), 'scripts/run.sh': strToU8('echo hi') });

      const res = await preview('flaky.zip', zip);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        name: existing.name,
        description: 'Flag flaky timing in tests.',
        type: 'custom',
        body: 'Body',
        warnings: [],
        ignored_files: [{ path: 'scripts/run.sh', reason: 'executable' }],
        conflict: true,
      });
      const after = (await app.inject({ method: 'GET', url: '/skills' })).json().length;
      expect(after).toBe(before);
    });

    it('previews a plain .md without conflict', async () => {
      const res = await preview('Brand New.md', strToU8('# Hello'));
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ name: 'brand-new', conflict: false, description: '' });
    });

    it('zip without SKILL.md → 422; oversize SKILL.md → 413', async () => {
      expect((await preview('x.zip', zipSync({ 'a.txt': strToU8('a') }))).statusCode).toBe(422);
      const big = zipSync({ 'SKILL.md': strToU8('a'.repeat(100 * 1024 + 1)) });
      const res = await preview('big.zip', big);
      expect(res.statusCode).toBe(413);
      expect(res.json().error.code).toBe('payload_too_large');
    });

    it('accepts a body above the global 1 MB limit (route bodyLimit is 2 MB)', async () => {
      // ~1.1 MB of base64 — not a zip, not .md → 422 from the handler, not a 413 from Fastify.
      const res = await preview('blob.bin', new Uint8Array(800 * 1024).fill(65));
      expect(res.statusCode).toBe(422);
    });
  });
});
