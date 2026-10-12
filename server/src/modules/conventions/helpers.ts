import { z } from 'zod';
import type { ConventionRow } from './repository.js';
import {
  AREA_DEPTH,
  CATEGORY_MAX,
  DEFAULT_CATEGORY,
  FENCE_LANG,
  FINDING_FORMAT,
  MAX_CANDIDATES,
  RULE_MAX,
  SAMPLE_MAX_CHARS,
  SAMPLE_MAX_LINES,
  SKILL_DESCRIPTION_MAX,
  SKILL_DESCRIPTION_MIN,
  SNIPPET_MAX_LINES,
  TEMPLATE_MAX_AREAS,
  TEMPLATE_SEVERITY,
} from './constants.js';

// ---- LLM output schema ----

/** What the model must return: candidates with file+line evidence. */
export const ConventionExtraction = z.object({
  candidates: z
    .array(
      z.object({
        category: z.string(),
        rule: z.string(),
        evidence: z.object({
          path: z.string(),
          line_start: z.number().int(),
          line_end: z.number().int(),
          snippet: z.string(),
        }),
        confidence: z.number(),
      }),
    )
    .max(MAX_CANDIDATES * 2),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;
export type RawCandidate = ConventionExtraction['candidates'][number];

// ---- DTO ----

export type ConventionStatus = 'pending' | 'accepted' | 'rejected';

export interface ConventionDto {
  id: string;
  category: string;
  rule: string;
  evidence_path: string;
  evidence_line_start: number;
  evidence_line_end: number;
  evidence_snippet: string;
  confidence: number;
  status: ConventionStatus;
  accepted: boolean;
  created_at: string;
}

export function toConventionDto(row: ConventionRow): ConventionDto {
  return {
    id: row.id,
    category: row.category,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_line_start: row.evidenceLineStart ?? 0,
    evidence_line_end: row.evidenceLineEnd ?? 0,
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    status: row.status,
    accepted: row.status === 'accepted',
    created_at: row.createdAt.toISOString(),
  };
}

// ---- Sampling ----

/**
 * A repo-relative path we are willing to read: no absolute paths, no drive
 * letters, no `..` segments. `GitClient.readFile` joins blindly, so this is
 * the traversal guard for anything a model hands back.
 */
export function isSafeRepoPath(path: string): boolean {
  if (!path || path.length > 500) return false;
  if (path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:/.test(path)) return false;
  if (path.includes('\0')) return false;
  return !path.split(/[\\/]/).some((seg) => seg === '..');
}

/** Normalize a model-supplied path (`./src/a.ts` → `src/a.ts`, backslashes → `/`). */
export function normalizeRepoPath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

export function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

/**
 * Line-numbered, truncated view of a file for the prompt (`  23| code`), so
 * the model can cite exact lines. Truncation is by lines, then by chars.
 */
export function numberLines(content: string): string {
  const lines = splitLines(content).slice(0, SAMPLE_MAX_LINES);
  const width = String(lines.length).length;
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const line = `${String(i + 1).padStart(width, ' ')}| ${lines[i]}\n`;
    if (out.length + line.length > SAMPLE_MAX_CHARS) return `${out}… (truncated)\n`;
    out += line;
  }
  return out;
}

// ---- Evidence verification ----

export type VerifyResult =
  | { ok: true; path: string; lineStart: number; lineEnd: number; snippet: string }
  | { ok: false; reason: 'unsafe_path' | 'not_sampled' | 'empty_snippet' | 'snippet_not_found' };

/** Collapse whitespace so indentation/spacing differences don't fail a match. */
function canon(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/** Strip a `  23| ` prefix the model may have copied from the numbered view. */
function stripLineNumber(line: string): string {
  return line.replace(/^\s*\d+\|\s?/, '');
}

/**
 * Check a candidate's evidence against the real file contents. The snippet
 * must occur in the file as consecutive non-blank lines (whitespace-insensitive).
 * The model's line numbers are only a hint: when the snippet sits elsewhere we
 * correct them, preferring the occurrence closest to the claimed start. The
 * returned snippet is always taken FROM THE FILE, never from the model.
 */
export function verifyEvidence(
  evidence: RawCandidate['evidence'],
  files: ReadonlyMap<string, string>,
): VerifyResult {
  const path = normalizeRepoPath(evidence.path);
  if (!isSafeRepoPath(path)) return { ok: false, reason: 'unsafe_path' };
  const content = files.get(path);
  if (content === undefined) return { ok: false, reason: 'not_sampled' };

  const wanted = splitLines(evidence.snippet)
    .map((l) => canon(stripLineNumber(l)))
    .filter((l) => l.length > 0)
    .slice(0, SNIPPET_MAX_LINES);
  if (wanted.length === 0) return { ok: false, reason: 'empty_snippet' };

  const fileLines = splitLines(content);
  const nonBlank: { idx: number; text: string }[] = [];
  fileLines.forEach((l, idx) => {
    const text = canon(l);
    if (text) nonBlank.push({ idx, text });
  });

  let best: { start: number; end: number } | undefined;
  for (let k = 0; k + wanted.length <= nonBlank.length; k++) {
    if (!wanted.every((w, j) => nonBlank[k + j]!.text === w)) continue;
    const start = nonBlank[k]!.idx + 1;
    const end = nonBlank[k + wanted.length - 1]!.idx + 1;
    if (!best || Math.abs(start - evidence.line_start) < Math.abs(best.start - evidence.line_start)) {
      best = { start, end };
    }
  }
  if (!best) return { ok: false, reason: 'snippet_not_found' };

  return {
    ok: true,
    path,
    lineStart: best.start,
    lineEnd: best.end,
    snippet: fileLines.slice(best.start - 1, best.end).join('\n'),
  };
}

// ---- Candidate shaping ----

/** Dedupe key for a rule: case/punctuation/whitespace-insensitive. */
export function normalizeRule(rule: string): string {
  return rule
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function cleanCategory(category: string): string {
  const c = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CATEGORY_MAX);
  return c || DEFAULT_CATEGORY;
}

export function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Some models answer in percent.
  const v = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, v));
}

export interface VerifiedCandidate {
  category: string;
  rule: string;
  evidencePath: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
  evidenceSnippet: string;
  confidence: number;
}

/**
 * Verify every raw candidate against the sampled files; drop those without
 * real evidence, empty rules and in-batch duplicates. Returns the survivors
 * (highest confidence first, capped) and how many were discarded.
 */
export function groundCandidates(
  raw: RawCandidate[],
  files: ReadonlyMap<string, string>,
): { verified: VerifiedCandidate[]; discarded: number } {
  const seen = new Set<string>();
  const verified: VerifiedCandidate[] = [];
  for (const c of raw) {
    const rule = c.rule.trim().slice(0, RULE_MAX);
    const key = normalizeRule(rule);
    if (!key || seen.has(key)) continue;
    const v = verifyEvidence(c.evidence, files);
    if (!v.ok) continue;
    seen.add(key);
    verified.push({
      category: cleanCategory(c.category),
      rule,
      evidencePath: v.path,
      evidenceLineStart: v.lineStart,
      evidenceLineEnd: v.lineEnd,
      evidenceSnippet: v.snippet,
      confidence: clampConfidence(c.confidence),
    });
  }
  verified.sort((a, b) => b.confidence - a.confidence);
  const kept = verified.slice(0, MAX_CANDIDATES);
  return { verified: kept, discarded: raw.length - kept.length };
}

/** True for a Postgres unique-violation (drizzle may wrap the driver error in `cause`). */
export function isUniqueViolation(err: unknown, code: string): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === code || e?.cause?.code === code;
}

// ---- Skill draft (accepted conventions → one skill body) ----

/** What the model writes for the merged skill — prose only, never evidence. */
export const ConventionSkillDraft = z.object({
  description: z.string(),
  summary: z.string(),
  when_to_use: z.array(z.string()),
  rules: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      rule: z.string(),
      flag_when: z.string(),
    }),
  ),
  not_violations: z.array(z.string()),
  severity: z.object({
    critical: z.string().optional(),
    warning: z.string(),
    suggestion: z.string(),
  }),
});
export type ConventionSkillDraft = z.infer<typeof ConventionSkillDraft>;

/** The verified data of an accepted convention that goes into the skill. */
export type DraftConvention = Pick<
  ConventionRow,
  'id' | 'category' | 'rule' | 'evidencePath' | 'evidenceLineStart' | 'evidenceLineEnd' | 'evidenceSnippet'
>;

/** `src/a.ts:23-31`, or `src/a.ts:23` for a single line. */
export function evidenceRef(c: DraftConvention): string {
  const a = c.evidenceLineStart ?? 0;
  const b = c.evidenceLineEnd ?? a;
  return a === b ? `${c.evidencePath}:${a}` : `${c.evidencePath}:${a}-${b}`;
}

function fenceLang(path: string | null): string {
  const ext = path?.split('.').pop()?.toLowerCase() ?? '';
  return FENCE_LANG[ext] ?? '';
}

/** A fence that backticks inside the snippet can't close early. */
function fenceFor(snippet: string): string {
  const longest = Math.max(2, ...(snippet.match(/`+/g) ?? []).map((m) => m.length));
  return '`'.repeat(longest + 1);
}

/** Single line, trimmed — model prose must not inject headings/sections. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Trim to the skill-description limits; `undefined` when unusable (too short)
 * so the caller can fall back to the template description.
 */
export function normalizeDescription(text: string): string | undefined {
  const d = oneLine(text);
  if (d.length < SKILL_DESCRIPTION_MIN) return undefined;
  if (d.length <= SKILL_DESCRIPTION_MAX) return d;
  const cut = d.slice(0, SKILL_DESCRIPTION_MAX - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SKILL_DESCRIPTION_MIN))}…`;
}

/** Most common directories (depth ≤ AREA_DEPTH) of the evidence paths. */
export function evidenceAreas(conventions: readonly DraftConvention[]): string[] {
  const counts = new Map<string, number>();
  for (const c of conventions) {
    const parts = (c.evidencePath ?? '').split('/').slice(0, -1).slice(0, AREA_DEPTH);
    const area = parts.length ? `${parts.join('/')}/` : '(repo root)';
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([area]) => area)
    .slice(0, TEMPLATE_MAX_AREAS);
}

function fileTypes(conventions: readonly DraftConvention[]): string[] {
  const exts = new Set<string>();
  for (const c of conventions) {
    const name = c.evidencePath?.split('/').pop() ?? '';
    const dot = name.lastIndexOf('.');
    if (dot > 0) exts.add(name.slice(dot));
  }
  return [...exts].sort();
}

/**
 * Deterministic draft (no LLM): used when the model is unavailable or its
 * answer is unusable. Description follows the "Flag … Use when …" contract.
 */
export function templateDraft(repoName: string, conventions: readonly DraftConvention[]): ConventionSkillDraft {
  const categories = [...new Set(conventions.map((c) => c.category))];
  const areas = evidenceAreas(conventions);
  const types = fileTypes(conventions);
  const where = `${areas.join(', ')}${types.length ? ` (${types.join(', ')})` : ''}`;
  return {
    description:
      normalizeDescription(
        `Flag changes that break ${repoName} house conventions (${categories.join(', ')}). ` +
          `Use when the diff adds or edits code in ${where}.`,
      ) ?? `Flag changes that break ${repoName} house conventions.`,
    summary:
      `Conventions observed in ${repoName} and backed by real code. ` +
      'New and changed code should follow them; each rule cites the example it was extracted from.',
    when_to_use: [
      `The diff adds or edits code in ${areas.join(', ')}.`,
      'A change introduces a new module, file or pattern that has an established counterpart here.',
    ],
    rules: conventions.map((c) => ({
      id: c.id,
      heading: c.category,
      rule: c.rule,
      flag_when: 'new or changed code does the opposite of this rule, or ignores the pattern in the example.',
    })),
    not_violations: [
      'Untouched legacy code — only flag lines the diff adds or changes.',
      'Generated files, vendored code, and tests that intentionally exercise the opposite behaviour.',
    ],
    severity: TEMPLATE_SEVERITY,
  };
}

/**
 * Render the skill body in the docs/skills-samples format. The `# heading` is
 * the skill's own name (never model-written). Prose comes from
 * the draft; EVIDENCE (path, lines, snippet) comes only from the verified DB
 * rows. Draft rules are matched by id: a convention the model skipped falls
 * back to its stored rule; ids the model invented are ignored.
 */
export function assembleSkillBody(
  name: string,
  draft: ConventionSkillDraft,
  conventions: readonly DraftConvention[],
): string {
  const byId = new Map(draft.rules.map((r) => [r.id, r]));
  const out: string[] = [`# ${oneLine(name)}`, '', oneLine(draft.summary), ''];

  const when = draft.when_to_use.map(oneLine).filter(Boolean);
  if (when.length) out.push('## When to use', '', ...when.map((w) => `- ${w}`), '');

  out.push('## Rules', '');
  conventions.forEach((c, i) => {
    const r = byId.get(c.id);
    const heading = oneLine(r?.heading || c.category);
    const rule = oneLine(r?.rule || c.rule);
    const snippet = c.evidenceSnippet ?? '';
    const fence = fenceFor(snippet);
    out.push(`### ${i + 1}. ${heading}`, '', rule, '');
    if (r?.flag_when) out.push(`**Flag when:** ${oneLine(r.flag_when)}`, '');
    out.push(`Example (\`${evidenceRef(c)}\`):`, '', `${fence}${fenceLang(c.evidencePath)}`, snippet, fence, '');
  });

  const nots = draft.not_violations.map(oneLine).filter(Boolean);
  if (nots.length) out.push('## Not a violation', '', ...nots.map((n) => `- ${n}`), '');

  out.push('## Severity', '');
  if (draft.severity.critical) out.push(`- **CRITICAL** — ${oneLine(draft.severity.critical)}`);
  out.push(
    `- **WARNING** — ${oneLine(draft.severity.warning)}`,
    `- **SUGGESTION** — ${oneLine(draft.severity.suggestion)}`,
    '',
    '## Finding format',
    '',
    FINDING_FORMAT,
    '',
  );
  return out.join('\n');
}
