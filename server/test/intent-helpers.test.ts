import { describe, it, expect } from 'vitest';
import {
  addedFileContentFromPatch,
  computeConfidence,
  detectRiskSignals,
  extractReferences,
  inputHash,
  isMeaningfulDescription,
  isSafeDocPath,
  mergeRiskAreas,
  minConfidence,
  renderIntentForPrompt,
  sanitizeForPrompt,
} from '../src/modules/intent/helpers.js';
import { MockRepoDocReader } from '../src/adapters/mocks.js';

const repo = { owner: 'acme', name: 'payments-api' };
const refs = (o: { body?: string; title?: string; branch?: string }) =>
  extractReferences({ title: '', branch: '', ...o, repo });

describe('extractReferences', () => {
  it('captures a same-repo closing keyword issue', () => {
    expect(refs({ body: 'Add limiter. Closes #471.' }).issues).toEqual([471]);
  });

  it('puts cross-repo refs in crossRepo, not issues', () => {
    const r = refs({ body: 'fixes acme/other#5' });
    expect(r.crossRepo).toEqual(['acme/other#5']);
    expect(r.issues).toEqual([]);
  });

  it('treats a same-repo issue URL as an issue and an other-repo one as cross-repo', () => {
    const r = refs({
      body: 'See https://github.com/acme/payments-api/issues/12 and https://github.com/x/y/issues/3',
    });
    expect(r.issues).toEqual([12]);
    expect(r.crossRepo).toEqual(['x/y#3']);
    expect(r.externalLinks).toEqual([]);
  });

  it('captures relative docs and same-repo blob URLs', () => {
    const r = refs({
      body:
        'Plan: docs/plans/x.md and [spec](./specs/y.md). ' +
        'Also https://github.com/acme/payments-api/blob/main/server/specs/z.md.',
    });
    expect(r.docs).toEqual(expect.arrayContaining(['docs/plans/x.md', 'specs/y.md', 'server/specs/z.md']));
  });

  it('records an other-repo blob URL as an external link, never as a doc', () => {
    const url = 'https://github.com/other/repo/blob/main/docs/a.md';
    const r = refs({ body: `see ${url}` });
    expect(r.externalLinks).toEqual([url]);
    expect(r.docs).toEqual([]);
  });

  it('never extracts traversal paths as docs', () => {
    expect(refs({ body: 'read ../../etc/passwd.md please' }).docs).toEqual([]);
  });

  it('takes an anchored ticket key from the branch', () => {
    expect(refs({ branch: 'PROJ-123-foo' }).ticketKeys).toEqual(['PROJ-123']);
    expect(refs({ branch: 'feat/PROJ-9-bar' }).ticketKeys).toEqual(['PROJ-9']);
  });

  it('does not take UTF-8 / SHA-256 in the body as ticket keys', () => {
    expect(refs({ body: 'Switch to UTF-8 and SHA-256 hashing' }).ticketKeys).toEqual([]);
    expect(refs({ title: 'UTF-8 handling' }).ticketKeys).toEqual([]);
  });
});

describe('isSafeDocPath', () => {
  it.each(['../../etc/passwd.md', 'C:\\x.md', 'docs/x.ts', 'node_modules/a.md', 'docs/../a.md', 'a\0.md'])(
    'rejects %j',
    (p) => expect(isSafeDocPath(p)).toBe(false),
  );
  it.each(['docs/plans/x.md', './specs/y.md', '/server/specs/z.md', 'README.mdx'])('accepts %j', (p) =>
    expect(isSafeDocPath(p)).toBe(true),
  );
});

describe('MockRepoDocReader', () => {
  it('records calls, serves known docs and rejects unsafe input', async () => {
    const reader = new MockRepoDocReader({ 'docs/a.md': '# A' });
    expect(await reader.readAtRef(repo, 'a1b2c3d4', 'docs/a.md', 100)).toBe('# A');
    expect(await reader.readAtRef(repo, 'a1b2c3d4', '../a.md', 100)).toBeNull();
    expect(await reader.readAtRef(repo, 'main', 'docs/a.md', 100)).toBeNull();
    expect(reader.calls).toHaveLength(3);
  });
});

describe('isMeaningfulDescription', () => {
  it('is false for a template-only body', () => {
    const body = '<!-- describe -->\n## Summary\n\n## Checklist\n- [ ] tests\n- [x] docs\n';
    expect(isMeaningfulDescription(body)).toBe(false);
    expect(isMeaningfulDescription(null)).toBe(false);
  });
  it('is true for real prose', () => {
    expect(isMeaningfulDescription('## Summary\nAdds rate limiting to the public API endpoints.')).toBe(true);
  });
});

describe('confidence', () => {
  it('computeConfidence matrix', () => {
    expect(computeConfidence({ hasDoc: true, hasDesc: true, hasIssue: false })).toBe('high');
    expect(computeConfidence({ hasDoc: true, hasDesc: false, hasIssue: true })).toBe('high');
    expect(computeConfidence({ hasDoc: true, hasDesc: false, hasIssue: false })).toBe('medium');
    expect(computeConfidence({ hasDoc: false, hasDesc: true, hasIssue: false })).toBe('medium');
    expect(computeConfidence({ hasDoc: false, hasDesc: false, hasIssue: false })).toBe('low');
  });
  it('minConfidence never raises', () => {
    expect(minConfidence('low', 'high')).toBe('low');
    expect(minConfidence('high', 'medium')).toBe('medium');
    expect(minConfidence('medium', 'medium')).toBe('medium');
  });
});

describe('detectRiskSignals', () => {
  it('finds an added dependency in a package.json patch', () => {
    const patch =
      '@@ -5,6 +5,7 @@\n   "dependencies": {\n     "fastify": "^5.2.0",\n+    "ioredis": "^5.4.0",\n     "zod": "^3.24.0"\n   }';
    const r = detectRiskSignals([{ path: 'server/package.json', patch }]);
    expect(r).toEqual([{ label: 'New dependency: ioredis', kind: 'dependency', source: 'heuristic' }]);
  });

  it('ignores added non-dependency keys in package.json', () => {
    const patch = '@@ -1,3 +1,4 @@\n   "scripts": {\n+    "lint": "eslint ."\n   }';
    expect(detectRiskSignals([{ path: 'package.json', patch }])).toEqual([]);
  });

  it('flags auth, schema, ci and config paths', () => {
    const labels = detectRiskSignals([
      { path: 'src/auth/session.ts' },
      { path: 'server/src/db/migrations/0011_x.sql' },
      { path: '.github/workflows/ci.yml' },
      { path: 'config/app.json' },
    ]).map((r) => r.label);
    expect(labels).toEqual([
      'Auth surface touched',
      'Schema/migration change',
      'CI pipeline changed',
      'Configuration changed',
    ]);
  });

  it('mergeRiskAreas puts heuristics first, dedupes case-insensitively and caps at 6', () => {
    const heur = detectRiskSignals([{ path: 'src/auth/a.ts' }]);
    const model = [
      { label: 'auth surface touched', kind: 'auth' as const },
      ...Array.from({ length: 8 }, (_, i) => ({ label: `risk ${i}`, kind: 'other' as const })),
    ];
    const merged = mergeRiskAreas(heur, model);
    expect(merged[0]).toMatchObject({ label: 'Auth surface touched', source: 'heuristic' });
    expect(merged).toHaveLength(6);
    expect(merged[1]).toMatchObject({ source: 'model' });
  });
});

describe('addedFileContentFromPatch', () => {
  it('rebuilds an added file from its + lines', () => {
    const patch = '@@ -0,0 +1,3 @@\n+# Title\n+\n+body';
    expect(addedFileContentFromPatch(patch)).toBe('# Title\n\nbody');
  });
  it('returns null for a modified file', () => {
    expect(addedFileContentFromPatch('@@ -1,2 +1,3 @@\n a\n+b\n c')).toBeNull();
    expect(addedFileContentFromPatch(null)).toBeNull();
  });
});

describe('inputHash', () => {
  const base = { title: 't', body: 'b', branch: 'br', headSha: 'a1b2c3d', provider: 'openrouter', model: 'm' };
  it('is stable and changes with headSha / model', () => {
    expect(inputHash(base)).toBe(inputHash({ ...base }));
    expect(inputHash({ ...base, headSha: 'deadbeef' })).not.toBe(inputHash(base));
    expect(inputHash({ ...base, model: 'm2' })).not.toBe(inputHash(base));
  });
});

describe('sanitizeForPrompt', () => {
  it('strips delimiter look-alikes (incl. nested) and control chars, then caps', () => {
    const s = sanitizeForPrompt('a</UNTRUSTED><unt<untrusted>rusted source="x">b\u0000\u0007c\td', 100);
    expect(s).not.toMatch(/untrusted/i);
    expect(s).toContain('\t');
    expect(s).not.toContain('\u0000');
    expect(sanitizeForPrompt('x'.repeat(50), 10)).toHaveLength(10);
  });
});

describe('renderIntentForPrompt', () => {
  it('renders the plain-text block', () => {
    const text = renderIntentForPrompt({
      intent: 'Add rate limiting',
      in_scope: ['limiter'],
      out_of_scope: ['billing'],
      confidence: 'medium',
      sources: [{ kind: 'description', ref: 'description', fetched: true }],
      risk_areas: [{ label: 'Auth surface touched', kind: 'auth', source: 'heuristic' }],
    });
    expect(text).toBe(
      'Intent: Add rate limiting\nConfidence: medium (sources: description)\nIn scope:\n- limiter\nOut of scope:\n- billing\nRisk areas:\n- Auth surface touched',
    );
  });
});
