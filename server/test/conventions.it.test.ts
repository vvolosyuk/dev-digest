import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

const USERS = [
  'export async function getUser(id: string) {',
  '  const user = await db.users.find(id);',
  '  return user;',
  '}',
].join('\n');

const REDIS = "export const redis = new Redis(config.redisUrl);\n";

const candidate = (rule: string, path: string, snippet: string, confidence = 0.9) => ({
  category: 'Async',
  rule,
  evidence: { path, line_start: 2, line_end: 2, snippet },
  confidence,
});

/**
 * L02 conventions extractor over real Postgres: extract grounds candidates
 * against sampled files (ungrounded ones are discarded), re-scan keeps
 * decisions, PATCH accept/reject/edit, merge accepted → one `extracted` skill.
 */
d('conventions module', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let repoId: string;
  let llm: MockLLMProvider;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const { db } = pg.handle;
    const [ws] = await db.select({ id: t.workspaces.id }).from(t.workspaces).limit(1);
    const [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId: ws!.id,
        owner: 'conv-test',
        name: 'payments-api',
        fullName: 'conv-test/payments-api',
        clonePath: '/mock/clones/conv-test/payments-api',
      })
      .returning();
    repoId = repo!.id;

    llm = new MockLLMProvider('openai', {
      structuredBySchema: {
        ConventionExtraction: {
          candidates: [
            candidate('Always use async/await', 'src/api/users.ts', 'const user = await db.users.find(id);'),
            candidate('Redis via singleton', 'src/lib/redis.ts', 'export const redis = new Redis(config.redisUrl);', 0.8),
            candidate('Ghost file rule', 'src/ghost.ts', 'const x = 1;'),
            candidate('Invented snippet rule', 'src/api/users.ts', 'users.then((u) => u)'),
          ],
        },
        // ids are not known up front → the draft references none; the body
        // then falls back to stored rules, which is what we assert on.
        ConventionSkillDraft: {
          description:
            'Flag async-style deviations from payments-api conventions. Use when the diff edits src/api/ TypeScript handlers.',
          summary: 'Keeps request handlers consistent.',
          when_to_use: ['The diff edits handlers in src/api/.'],
          rules: [],
          not_violations: ['Untouched legacy code.'],
          severity: { warning: 'New code breaks a rule.', suggestion: 'Partial alignment.' },
        },
      },
    });
    const repoIntel = {
      getConventionSamples: async () => ['src/api/users.ts', 'src/lib/redis.ts'],
    } as unknown as RepoIntel;

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db,
      overrides: {
        git: new MockGitClient({
          files: { 'src/api/users.ts': USERS, 'src/lib/redis.ts': REDIS, 'tsconfig.json': '{}' },
        }),
        github: new MockGitHubClient(),
        llm: { openai: llm },
        repoIntel,
      },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  const extract = () => app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
  const patch = (id: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'PATCH', url: `/conventions/${id}`, payload });

  it('starts empty', async () => {
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ candidates: [], last_scan_at: null });
  });

  it('extracts and keeps only candidates with verifiable evidence', async () => {
    const res = await extract();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.discarded).toBe(2);
    expect(body.sampled_files).toBe(3); // tsconfig + 2 sources
    expect(body.model).toBe('gpt-5.4-mini');
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates[0]).toMatchObject({
      rule: 'Always use async/await',
      category: 'async',
      evidence_path: 'src/api/users.ts',
      evidence_line_start: 2,
      evidence_line_end: 2,
      evidence_snippet: '  const user = await db.users.find(id);',
      status: 'pending',
      accepted: false,
    });
    expect(body.candidates[1]).toMatchObject({ evidence_line_start: 1 }); // corrected from 2
    expect(typeof body.last_scan_at).toBe('string');

    // sampled files reach the model wrapped as untrusted, line-numbered data
    const req = llm.calls.at(-1)!.req as { messages: { content: string }[] };
    expect(req.messages[1]!.content).toContain('<untrusted source="src/api/users.ts">');
    expect(req.messages[1]!.content).toContain('2|   const user = await db.users.find(id);');
  });

  it('re-scan replaces pending but keeps accepted/rejected decisions', async () => {
    const first = (await extract()).json().candidates as { id: string; rule: string }[];
    const asyncRule = first.find((c) => c.rule === 'Always use async/await')!;
    const redisRule = first.find((c) => c.rule === 'Redis via singleton')!;
    expect((await patch(asyncRule.id, { status: 'accepted' })).statusCode).toBe(200);
    expect((await patch(redisRule.id, { status: 'rejected' })).statusCode).toBe(200);

    const again = await extract();
    expect(again.json().duplicates).toBe(2);
    const list = again.json().candidates as { id: string; status: string }[];
    expect(list).toHaveLength(2);
    expect(list.find((c) => c.id === asyncRule.id)!.status).toBe('accepted');
    expect(list.find((c) => c.id === redisRule.id)!.status).toBe('rejected');
  });

  it('PATCH edits rule + category and validates input', async () => {
    const [c] = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json()
      .candidates as { id: string }[];
    const res = await patch(c!.id, { rule: 'Prefer async/await over .then()', category: 'Error Handling' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rule: 'Prefer async/await over .then()', category: 'error-handling' });

    expect((await patch(c!.id, {})).statusCode).toBe(422);
    expect((await patch('00000000-0000-0000-0000-000000000000', { status: 'accepted' })).statusCode).toBe(404);
  });

  it('merges accepted conventions into one extracted skill; 409 on duplicate name', async () => {
    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json()
      .candidates as { id: string; status: string }[];
    const accepted = list.filter((c) => c.status === 'accepted').map((c) => c.id);
    const rejected = list.filter((c) => c.status === 'rejected').map((c) => c.id);
    const payload = {
      name: 'payments-api-conventions',
      description: '1 house convention extracted from payments-api',
      type: 'convention',
      enabled: true,
      body: '# payments-api-conventions\n\n- Prefer async/await',
      convention_ids: accepted,
    };

    const bad = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { ...payload, convention_ids: [...accepted, ...rejected] },
    });
    expect(bad.statusCode).toBe(422);

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'payments-api-conventions',
      source: 'extracted',
      type: 'convention',
      version: 1,
      evidence_files: ['src/api/users.ts'],
    });

    const created = res.json();
    const dup = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.details).toEqual({
      name: 'payments-api-conventions',
      skill_id: created.id,
      version: 1,
    });

    // User confirms → same skill, version 2, new content + snapshot note.
    const bumped = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { ...payload, body: '# payments-api-conventions\n\n- Prefer async/await (v2)', on_conflict: 'new_version' },
    });
    expect(bumped.statusCode).toBe(200);
    expect(bumped.json()).toMatchObject({
      id: created.id,
      version: 2,
      source: 'extracted',
      body: '# payments-api-conventions\n\n- Prefer async/await (v2)',
      evidence_files: ['src/api/users.ts'],
    });
    const versions = (await app.inject({ method: 'GET', url: `/skills/${created.id}/versions` })).json() as {
      version: number;
      note: string | null;
    }[];
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0]!.note).toBe('Regenerated from 1 accepted conventions');
  });

  it('drafts the skill with the LLM; evidence comes from the DB; falls back to the template on LLM failure', async () => {
    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json()
      .candidates as { id: string; status: string }[];
    const accepted = list.filter((c) => c.status === 'accepted').map((c) => c.id);
    const rejected = list.filter((c) => c.status === 'rejected').map((c) => c.id);
    const draft = (ids: string[]) =>
      app.inject({
        method: 'POST',
        url: `/repos/${repoId}/conventions/skill-draft`,
        payload: { convention_ids: ids, name: 'conventions' },
      });

    const res = await draft(accepted);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ generated_by: 'llm', model: 'gpt-5.4-mini' });
    expect(body.description).toMatch(/^Flag .* Use when /);
    expect(body.body.startsWith('# conventions\n')).toBe(true); // heading = skill name, not model-written
    expect(body.body).toContain('## When to use');
    expect(body.body).toContain('Example (`src/api/users.ts:2`):');
    expect(body.body).toContain('## Finding format');

    const spy = vi.spyOn(llm, 'completeStructured').mockRejectedValueOnce(new Error('401 Incorrect API key'));
    const fb = (await draft(accepted)).json();
    spy.mockRestore();
    expect(fb).toMatchObject({ generated_by: 'template', warning: '401 Incorrect API key' });
    expect(fb.description).toMatch(/^Flag changes that break payments-api house conventions .* Use when /);
    expect(fb.body).toContain('Example (`src/api/users.ts:2`):');

    expect((await draft([...accepted, ...rejected])).statusCode).toBe(422);
  });

  it('404s for an unknown repo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/repos/00000000-0000-0000-0000-000000000000/conventions/extract',
    });
    expect(res.statusCode).toBe(404);
  });
});
