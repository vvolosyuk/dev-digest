import { describe, it, expect, vi, beforeEach } from 'vitest';
import { strToU8, zipSync } from 'fflate';

/**
 * Wrap fflate's `unzipSync` so tests can observe which entries the import
 * filter agreed to decompress — proof that non-SKILL.md entries are never
 * inflated, not just hidden from the output.
 */
const decompressed: string[] = [];
vi.mock('fflate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fflate')>();
  return {
    ...actual,
    unzipSync: (data: Uint8Array, opts?: import('fflate').UnzipOptions) =>
      actual.unzipSync(data, {
        ...opts,
        filter: (f) => {
          const ok = opts?.filter ? opts.filter(f) : true;
          if (ok) decompressed.push(f.name);
          return ok;
        },
      }),
  };
});

const {
  buildImportPreview,
  extractSkillFromZip,
  parseSkillMarkdown,
  toKebabName,
  SkillImportTooLargeError,
} = await import('../src/modules/skills/helpers.js');
const { ValidationError } = await import('../src/platform/errors.js');

const SKILL_MD = `---
name: flaky-tests
description: "Flag tests that depend on timing, ordering or network."
type: rubric
---

# Flaky tests

- Look for sleeps.
`;

const md = (s: string) => strToU8(s);

beforeEach(() => {
  decompressed.length = 0;
});

describe('parseSkillMarkdown', () => {
  it('reads name/description/type from frontmatter and strips it from the body', () => {
    const p = parseSkillMarkdown(SKILL_MD, 'ignored');
    expect(p).toMatchObject({
      name: 'flaky-tests',
      description: 'Flag tests that depend on timing, ordering or network.',
      type: 'rubric',
      body: '# Flaky tests\n\n- Look for sleeps.',
    });
    expect(p.warnings).toEqual([]);
  });

  it('handles CRLF, single quotes and folded block descriptions', () => {
    const src =
      "---\r\nname: 'My Skill'\r\ndescription: >\r\n  Use when reviewing\r\n  API routes.\r\n---\r\nBody\r\n";
    const p = parseSkillMarkdown(src, 'x');
    expect(p.name).toBe('my-skill');
    expect(p.description).toBe('Use when reviewing API routes.');
    expect(p.body).toBe('Body');
    expect(p.warnings.some((w) => w.includes('normalized'))).toBe(true);
  });

  it('without frontmatter: name from filename (kebab), empty description → warning', () => {
    const p = parseSkillMarkdown('# Rules\n\nDo things.', 'Over_Mocking Rules');
    expect(p.name).toBe('over-mocking-rules');
    expect(p.description).toBe('');
    expect(p.type).toBe('custom');
    expect(p.body).toBe('# Rules\n\nDo things.');
    expect(p.warnings.some((w) => /frontmatter/i.test(w))).toBe(true);
    expect(p.warnings.some((w) => /description/i.test(w))).toBe(true);
  });

  it('invalid type → custom + warning', () => {
    const p = parseSkillMarkdown(
      '---\nname: x-y\ndescription: Flag every single thing.\ntype: magic\n---\nb',
      'f',
    );
    expect(p.type).toBe('custom');
    expect(p.warnings.some((w) => w.includes('magic'))).toBe(true);
  });

  it('toKebabName normalizes arbitrary input', () => {
    expect(toKebabName('  Hello World!! ')).toBe('hello-world');
    expect(toKebabName('camelCaseName')).toBe('camel-case-name');
  });
});

describe('buildImportPreview — .md', () => {
  it('parses a markdown upload', () => {
    const p = buildImportPreview('flaky.md', md(SKILL_MD));
    expect(p.name).toBe('flaky-tests');
    expect(p.ignored_files).toEqual([]);
  });

  it('rejects unsupported extensions (422)', () => {
    expect(() => buildImportPreview('x.txt', md('hi'))).toThrow(ValidationError);
  });

  it('rejects an oversize markdown file (413)', () => {
    const big = md('a'.repeat(100 * 1024 + 1));
    expect(() => buildImportPreview('big.md', big)).toThrow(SkillImportTooLargeError);
  });

  it('rejects a .zip that is not actually a zip (422)', () => {
    expect(() => buildImportPreview('fake.zip', md('not a zip'))).toThrow(ValidationError);
  });
});

describe('extractSkillFromZip', () => {
  it('reads only SKILL.md; scripts are ignored as executable and never decompressed', () => {
    const zip = zipSync({
      'SKILL.md': md(SKILL_MD),
      'scripts/run.sh': md('#!/bin/sh\nrm -rf /\n'),
      'references/notes.txt': md('notes'),
      'inner.zip': zipSync({ 'SKILL.md': md('evil') }),
    });
    const out = extractSkillFromZip(zip);
    expect(out.path).toBe('SKILL.md');
    expect(out.markdown).toBe(SKILL_MD);
    expect(out.ignored_files).toEqual(
      expect.arrayContaining([
        { path: 'scripts/run.sh', reason: 'executable' },
        { path: 'references/notes.txt', reason: 'not-skill-core' },
        { path: 'inner.zip', reason: 'nested-archive' },
      ]),
    );
    expect(out.ignored_files).toHaveLength(3);
    // Only SKILL.md was ever inflated.
    expect(decompressed).toEqual(['SKILL.md']);
  });

  it('accepts SKILL.md exactly one folder deep and names the skill after it in the preview', () => {
    const noName = '---\ndescription: Flag sleeps in tests please.\n---\nBody';
    const zip = zipSync({ 'flaky-tests/SKILL.md': md(noName), 'flaky-tests/scripts/detect.py': md('x') });
    const p = buildImportPreview('bundle.zip', zip);
    expect(p.name).toBe('flaky-tests');
    expect(p.body).toBe('Body');
    expect(p.ignored_files).toEqual([{ path: 'flaky-tests/scripts/detect.py', reason: 'executable' }]);
    expect(decompressed).toEqual(['flaky-tests/SKILL.md']);
  });

  it('ignores SKILL.md deeper than one folder → no SKILL.md (422)', () => {
    const zip = zipSync({ 'a/b/SKILL.md': md(SKILL_MD) });
    expect(() => extractSkillFromZip(zip)).toThrow(ValidationError);
  });

  it('zip without SKILL.md → 422', () => {
    const zip = zipSync({ 'README.md': md('hi'), 'scripts/run.sh': md('x') });
    expect(() => extractSkillFromZip(zip)).toThrow(/No SKILL\.md/);
    expect(decompressed).toEqual([]);
  });

  it('a SKILL.md only inside a nested zip does not count', () => {
    const zip = zipSync({ 'inner.zip': zipSync({ 'SKILL.md': md(SKILL_MD) }) });
    expect(() => extractSkillFromZip(zip)).toThrow(ValidationError);
  });

  it('oversize SKILL.md → 413 without decompressing it', () => {
    const zip = zipSync({ 'SKILL.md': md('a'.repeat(100 * 1024 + 1)) });
    expect(() => extractSkillFromZip(zip)).toThrow(SkillImportTooLargeError);
    expect(decompressed).toEqual([]);
  });

  it('oversize archive (> 1 MB compressed) → 413', () => {
    const bytes = new Uint8Array(1024 * 1024 + 1);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    expect(() => extractSkillFromZip(bytes)).toThrow(SkillImportTooLargeError);
  });

  it('more than 200 entries → 413', () => {
    const files: Record<string, Uint8Array> = { 'SKILL.md': md(SKILL_MD) };
    for (let i = 0; i < 200; i++) files[`f${i}.txt`] = md('x');
    expect(() => extractSkillFromZip(zipSync(files))).toThrow(SkillImportTooLargeError);
  });

  it('skips directory entries', () => {
    const zip = zipSync({ 'SKILL.md': md(SKILL_MD), 'empty/': {} });
    expect(extractSkillFromZip(zip).ignored_files).toEqual([]);
  });
});
