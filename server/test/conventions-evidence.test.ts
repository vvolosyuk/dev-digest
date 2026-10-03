import { describe, it, expect } from 'vitest';
import {
  clampConfidence,
  cleanCategory,
  groundCandidates,
  isSafeRepoPath,
  normalizeRule,
  numberLines,
  verifyEvidence,
  type RawCandidate,
} from '../src/modules/conventions/helpers.js';

/** L02 conventions — mechanical evidence grounding (no DB, no LLM). */

const USERS = [
  "import { db } from '../db';",
  '',
  'export async function getUser(id: string) {',
  '  const user = await db.users.find(id);',
  '',
  '  const posts = await db.posts.findMany({ userId: id });',
  '  return { user, posts };',
  '}',
].join('\n');

const files = new Map([['src/api/users.ts', USERS]]);

const ev = (over: Partial<RawCandidate['evidence']> = {}): RawCandidate['evidence'] => ({
  path: 'src/api/users.ts',
  line_start: 4,
  line_end: 6,
  snippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId: id });',
  ...over,
});

describe('isSafeRepoPath', () => {
  it.each(['src/a.ts', 'a/b/c.tsx', '.eslintrc.json'])('accepts %s', (p) => {
    expect(isSafeRepoPath(p)).toBe(true);
  });
  it.each(['', '/etc/passwd', '\\x', 'C:/win', '../secret', 'src/../../x', 'a\0b'])(
    'rejects %j',
    (p) => {
      expect(isSafeRepoPath(p)).toBe(false);
    },
  );
});

describe('verifyEvidence', () => {
  it('accepts a verbatim snippet (blank lines/indentation ignored) and returns file text', () => {
    const r = verifyEvidence(ev(), files);
    expect(r).toEqual({
      ok: true,
      path: 'src/api/users.ts',
      lineStart: 4,
      lineEnd: 6,
      snippet: '  const user = await db.users.find(id);\n\n  const posts = await db.posts.findMany({ userId: id });',
    });
  });

  it('corrects wrong line numbers when the snippet exists elsewhere', () => {
    const r = verifyEvidence(ev({ line_start: 40, line_end: 42 }), files);
    expect(r).toMatchObject({ ok: true, lineStart: 4, lineEnd: 6 });
  });

  it('strips copied `NN| ` prefixes and normalizes ./ paths', () => {
    const r = verifyEvidence(
      ev({ path: './src/api/users.ts', snippet: '  4|   const user = await db.users.find(id);' }),
      files,
    );
    expect(r).toMatchObject({ ok: true, lineStart: 4, lineEnd: 4 });
  });

  it('rejects an invented snippet', () => {
    expect(verifyEvidence(ev({ snippet: 'const user = await getUserById(id);' }), files)).toEqual({
      ok: false,
      reason: 'snippet_not_found',
    });
  });

  it('rejects files outside the sample, unsafe paths and empty snippets', () => {
    expect(verifyEvidence(ev({ path: 'src/other.ts' }), files)).toMatchObject({ reason: 'not_sampled' });
    expect(verifyEvidence(ev({ path: '../etc/passwd' }), files)).toMatchObject({ reason: 'unsafe_path' });
    expect(verifyEvidence(ev({ snippet: '  \n ' }), files)).toMatchObject({ reason: 'empty_snippet' });
  });
});

describe('groundCandidates', () => {
  const cand = (over: Partial<RawCandidate> = {}): RawCandidate => ({
    category: 'Async',
    rule: 'Always use async/await instead of .then() chains',
    evidence: ev(),
    confidence: 0.9,
    ...over,
  });

  it('keeps grounded candidates, drops the rest and in-batch duplicates', () => {
    const { verified, discarded } = groundCandidates(
      [
        cand(),
        cand({ rule: 'always use async/await instead of .then() chains!' }), // duplicate
        cand({ rule: 'Missing file', evidence: ev({ path: 'nope.ts' }) }),
        cand({ rule: 'Invented', evidence: ev({ snippet: 'fetch().then(x)' }) }),
        cand({ rule: 'Imports db from ../db', category: 'Imports', confidence: 91 }),
      ],
      files,
    );
    // highest confidence first (91 → 0.91 beats 0.9)
    expect(verified.map((v) => v.rule)).toEqual([
      'Imports db from ../db',
      'Always use async/await instead of .then() chains',
    ]);
    expect(verified[0]!.confidence).toBeCloseTo(0.91);
    expect(verified[1]).toMatchObject({ category: 'async', evidenceLineStart: 4 });
    expect(discarded).toBe(3);
  });
});

describe('small helpers', () => {
  it('numberLines prefixes 1-based padded line numbers', () => {
    expect(numberLines('a\nb')).toBe('1| a\n2| b\n');
  });
  it('normalizeRule ignores case and punctuation', () => {
    expect(normalizeRule('Use  async/await!')).toBe(normalizeRule('use async await'));
  });
  it('cleanCategory kebab-cases and defaults', () => {
    expect(cleanCategory('Error Handling')).toBe('error-handling');
    expect(cleanCategory('  ')).toBe('general');
  });
  it('clampConfidence handles percent and garbage', () => {
    expect(clampConfidence(78)).toBeCloseTo(0.78);
    expect(clampConfidence(-1)).toBe(0);
    expect(clampConfidence(Number.NaN)).toBe(0);
  });
});
