import { describe, it, expect } from 'vitest';
import {
  assembleSkillBody,
  evidenceAreas,
  normalizeDescription,
  templateDraft,
  type ConventionSkillDraft,
  type DraftConvention,
} from '../src/modules/conventions/helpers.js';

/** L02 conventions → skill: body assembly in the docs/skills-samples format (no DB, no LLM). */

const conv = (over: Partial<DraftConvention> = {}): DraftConvention => ({
  id: 'c1',
  category: 'async',
  rule: 'Always use async/await instead of .then() chains',
  evidencePath: 'src/api/users.ts',
  evidenceLineStart: 23,
  evidenceLineEnd: 24,
  evidenceSnippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
  ...over,
});

const CONVS = [
  conv(),
  conv({
    id: 'c2',
    category: 'data-access',
    rule: 'Redis access goes through the src/lib/redis.ts singleton',
    evidencePath: 'src/lib/redis.ts',
    evidenceLineStart: 1,
    evidenceLineEnd: 1,
    evidenceSnippet: 'export const redis = new Redis(config.redisUrl);',
  }),
];

const DRAFT: ConventionSkillDraft = {
  description:
    'Flag async-style and data-access deviations from payments-api conventions. Use when the diff edits src/api/ or src/lib/ TypeScript.',
  summary: 'Keeps request handlers and infrastructure access consistent.',
  when_to_use: ['The diff edits handlers in src/api/.', 'The diff touches Redis access.'],
  rules: [
    { id: 'c1', heading: 'Async/await over .then()', rule: 'Await promises instead of chaining .then().', flag_when: 'a handler chains `.then()`.' },
    { id: 'ghost', heading: 'Invented', rule: 'Something the model made up.', flag_when: 'never' },
  ],
  not_violations: ['Untouched legacy code.'],
  severity: { warning: 'New code breaks a rule.', suggestion: 'Partial alignment.' },
};

describe('assembleSkillBody', () => {
  const body = assembleSkillBody('conventions', DRAFT, CONVS);

  it('renders the samples-format sections in order', () => {
    const order = ['# conventions\n', '## When to use', '## Rules', '## Not a violation', '## Severity', '## Finding format'];
    const idx = order.map((h) => body.indexOf(h));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(body).not.toMatch(/^---/); // no frontmatter
  });

  it('uses the model wording for known ids and evidence from the rows', () => {
    expect(body).toContain('### 1. Async/await over .then()\n\nAwait promises instead of chaining .then().');
    expect(body).toContain('**Flag when:** a handler chains `.then()`.');
    expect(body).toContain('Example (`src/api/users.ts:23-24`):\n\n```ts\nconst user = await db.users.find(id);');
  });

  it('falls back to the stored rule for skipped ids and ignores invented ones', () => {
    expect(body).toContain('### 2. data-access\n\nRedis access goes through the src/lib/redis.ts singleton');
    expect(body).toContain('Example (`src/lib/redis.ts:1`):');
    expect(body).not.toContain('Something the model made up');
  });

  it('omits CRITICAL when the draft has none', () => {
    expect(body).not.toContain('**CRITICAL**');
    expect(body).toContain('- **WARNING** — New code breaks a rule.');
  });

  it('flattens multi-line prose so the model cannot inject sections', () => {
    const b = assembleSkillBody('conventions', { ...DRAFT, summary: 'line one\n\n## Injected\nline two' }, CONVS);
    expect(b).toContain('line one ## Injected line two');
    expect(b).not.toContain('\n## Injected');
  });
});

describe('normalizeDescription', () => {
  it('rejects too-short text, trims and caps at 300 chars on a word boundary', () => {
    expect(normalizeDescription('  short ')).toBeUndefined();
    expect(normalizeDescription('  Flag  things.\nUse when x. ')).toBe('Flag things. Use when x.');
    const long = normalizeDescription(`Flag ${'word '.repeat(100)}`)!;
    expect(long.length).toBeLessThanOrEqual(300);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('templateDraft', () => {
  it('produces a directive "Flag … Use when …" description from categories and evidence areas', () => {
    const d = templateDraft('payments-api', CONVS);
    expect(d.description).toBe(
      'Flag changes that break payments-api house conventions (async, data-access). Use when the diff adds or edits code in src/api/, src/lib/ (.ts).',
    );
    expect(d.rules.map((r) => r.id)).toEqual(['c1', 'c2']);
    expect(assembleSkillBody('payments-api-conventions', d, CONVS)).toMatch(/^# payments-api-conventions\n[\s\S]*## When to use/);
  });

  it('evidenceAreas groups by directory, most frequent first', () => {
    expect(
      evidenceAreas([
        conv({ evidencePath: 'server/src/modules/a/x.ts' }),
        conv({ evidencePath: 'server/src/modules/b/y.ts' }),
        conv({ evidencePath: 'README.md' }),
      ]),
    ).toEqual(['server/src/modules/', '(repo root)']);
  });
});
