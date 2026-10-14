import { createHash } from 'node:crypto';
import { normalizeDocPath } from '../../adapters/repo-docs/index.js';
import { BUDGET, MIN_MEANINGFUL_DESCRIPTION_CHARS, PROMPT_VERSION } from './constants.js';
import type { Confidence, IntentRiskArea, PrIntentRecord, RiskKind } from './schemas.js';

/**
 * Pure helpers for the intent module (no I/O). Everything here handles
 * attacker-controlled PR text, so it only extracts, bounds and normalises —
 * it never fetches anything.
 */

export { isSafeDocPath } from '../../adapters/repo-docs/index.js';

// ------------------------------------------------------------------ references

export interface ExtractedReferences {
  /** Same-repo issue numbers (fetchable). */
  issues: number[];
  /** Same-repo markdown doc paths, normalised (fetchable at the PR head). */
  docs: string[];
  /** `owner/repo#N` refs to OTHER repos — recorded, never fetched. */
  crossRepo: string[];
  /** Anchored Jira/Linear-style keys — recorded, never fetched. */
  ticketKeys: string[];
  /** Non-GitHub / other-repo URLs — recorded, never fetched (SSRF). */
  externalLinks: string[];
}

const CLOSING = String.raw`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)`;
const CLOSING_LOCAL_RE = new RegExp(String.raw`\b${CLOSING}:?\s+#(\d{1,9})\b`, 'gi');
const CLOSING_QUALIFIED_RE = new RegExp(
  String.raw`\b${CLOSING}:?\s+([\w.-]+)\/([\w.-]+)#(\d{1,9})\b`,
  'gi',
);
const URL_RE = /https?:\/\/[^\s)<>\]"'`]+/gi;
const TICKET_KEY = String.raw`[A-Z][A-Z0-9]{1,9}-\d{1,6}`;
/** Uppercase look-alikes that are not tickets (`UTF-8`, `SHA-256`, …). */
const NOT_TICKETS = new Set(['UTF', 'SHA', 'ISO', 'HTTP', 'MD', 'AES', 'RSA', 'TLS', 'SSL', 'IPV', 'ES', 'X', 'CVE', 'RFC']);

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function stripTrailingPunct(url: string): string {
  return url.replace(/[.,;:!?]+$/, '');
}

function pushUnique<T>(arr: T[], v: T): void {
  if (!arr.includes(v)) arr.push(v);
}

function ticketKeyOk(key: string): boolean {
  const prefix = key.split('-')[0] ?? '';
  return !NOT_TICKETS.has(prefix);
}

export function extractReferences(input: {
  body?: string | null;
  title?: string | null;
  branch?: string | null;
  repo: { owner: string; name: string };
}): ExtractedReferences {
  const { repo } = input;
  const title = input.title ?? '';
  const body = input.body ?? '';
  const branch = input.branch ?? '';
  const text = `${title}\n${body}`;
  const out: ExtractedReferences = {
    issues: [],
    docs: [],
    crossRepo: [],
    ticketKeys: [],
    externalLinks: [],
  };

  // `owner/repo#N` with a closing keyword: same repo → fetchable issue.
  for (const m of text.matchAll(CLOSING_QUALIFIED_RE)) {
    const [, owner, name, n] = m;
    if (same(owner!, repo.owner) && same(name!, repo.name)) pushUnique(out.issues, Number(n));
    else pushUnique(out.crossRepo, `${owner}/${name}#${n}`);
  }
  // `Closes #N` (same repo).
  for (const m of text.matchAll(CLOSING_LOCAL_RE)) pushUnique(out.issues, Number(m[1]));

  // URLs: issue links, same-repo blob docs, everything else is recorded only.
  for (const m of text.matchAll(URL_RE)) {
    const raw = stripTrailingPunct(m[0]);
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const isGithub = u.hostname === 'github.com' || u.hostname === 'www.github.com';
    const seg = u.pathname.split('/').filter(Boolean);
    const sameRepo = seg.length >= 2 && same(seg[0]!, repo.owner) && same(seg[1]!, repo.name);
    if (isGithub && seg[2] === 'issues' && /^\d+$/.test(seg[3] ?? '')) {
      if (sameRepo) pushUnique(out.issues, Number(seg[3]));
      else pushUnique(out.crossRepo, `${seg[0]}/${seg[1]}#${seg[3]}`);
      continue;
    }
    if (isGithub && sameRepo && seg[2] === 'blob' && seg.length >= 5) {
      // /owner/repo/blob/<ref>/<path…>  (ref is a single segment; the path is
      // re-resolved against the PR HEAD, so the link's own ref is ignored).
      const safe = normalizeDocPath(decodeURIComponentSafe(seg.slice(4).join('/')));
      if (safe) {
        pushUnique(out.docs, safe);
        continue;
      }
    }
    if (out.externalLinks.length < BUDGET.externalLinks) pushUnique(out.externalLinks, raw);
  }

  // Relative markdown docs (links or bare mentions), URLs removed first so a
  // URL's path component isn't mistaken for a repo path.
  const noUrls = text.replace(URL_RE, ' ');
  const DOC_CANDIDATE_RE = /(?:^|[\s("'`[])((?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.mdx?)(?=$|[\s)"'`\],:;#?])/gim;
  for (const m of noUrls.matchAll(DOC_CANDIDATE_RE)) {
    const safe = normalizeDocPath(m[1]!);
    if (safe) pushUnique(out.docs, safe);
  }

  // Ticket keys: ONLY anchored positions (branch start / after `/`, title lead
  // or bracketed) — never scanned in the body (`UTF-8`, `SHA-256` false hits).
  const branchKey = new RegExp(String.raw`(?:^|/)(${TICKET_KEY})(?![\w])`).exec(branch);
  if (branchKey && ticketKeyOk(branchKey[1]!)) pushUnique(out.ticketKeys, branchKey[1]!);
  const titleLead = new RegExp(String.raw`^\s*\[?(${TICKET_KEY})\]?(?![\w])`).exec(title);
  if (titleLead && ticketKeyOk(titleLead[1]!)) pushUnique(out.ticketKeys, titleLead[1]!);
  for (const m of title.matchAll(new RegExp(String.raw`\[(${TICKET_KEY})\]`, 'g'))) {
    if (ticketKeyOk(m[1]!)) pushUnique(out.ticketKeys, m[1]!);
  }

  return out;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ------------------------------------------------------------------ description

/** True when the PR body carries real prose, not just a filled-in template. */
export function isMeaningfulDescription(body: string | null | undefined): boolean {
  if (!body) return false;
  const stripped = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split('\n')
    .filter((line) => {
      const l = line.trim();
      if (l === '') return false;
      if (/^#{1,6}\s/.test(l)) return false; // template headings
      if (/^[-*+]\s*\[[ xX]\]/.test(l)) return false; // checkbox lines
      if (/^[-*_]{3,}$/.test(l)) return false; // rules
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length >= MIN_MEANINGFUL_DESCRIPTION_CHARS;
}

// ------------------------------------------------------------------ confidence

export function computeConfidence(s: {
  hasDoc: boolean;
  hasDesc: boolean;
  hasIssue: boolean;
}): Confidence {
  if (s.hasDoc && (s.hasDesc || s.hasIssue)) return 'high';
  if (s.hasDoc || s.hasDesc || s.hasIssue) return 'medium';
  return 'low';
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/** The model may lower the deterministic confidence, never raise it. */
export function minConfidence(a: Confidence, b: Confidence): Confidence {
  return RANK[a] <= RANK[b] ? a : b;
}

// ------------------------------------------------------------------ risk areas

const DEP_BLOCKS = new Set(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']);
const META_KEYS = new Set([
  'name', 'version', 'description', 'main', 'module', 'types', 'license', 'author',
  'homepage', 'packageManager', 'type', 'private',
]);
const VERSION_LIKE = /^(?:[~^<>=]*\s*v?\d|\*$|latest$|(?:workspace|npm|file|link|git|github):)/;
const DEP_LINE = /^\+\s*"([@\w][\w@/.-]*)"\s*:\s*"([^"]*)"\s*,?\s*$/;
const BLOCK_OPEN = /^\s*"(\w+)"\s*:\s*\{/;

function addedDependencies(patch: string): string[] {
  const names: string[] = [];
  // undefined = hunk started inside an unknown block; null = known outside any block.
  let block: string | null | undefined;
  for (const line of patch.split('\n')) {
    const body = line.slice(1);
    const open = BLOCK_OPEN.exec(body);
    if (open) block = open[1]!;
    else if (/^\s*\}/.test(body)) block = null;
    const dep = DEP_LINE.exec(line);
    if (!dep) continue;
    const [, name, version] = dep;
    const inDeps =
      (typeof block === 'string' && DEP_BLOCKS.has(block)) ||
      (block === undefined && !META_KEYS.has(name!) && VERSION_LIKE.test(version!));
    if (inDeps) pushUnique(names, name!);
  }
  return names;
}

const AUTH_PATH = /(?:^|[/._-])(?:auth\w*|session\w*|token\w*|permission\w*|oauth\w*|jwt|login|rbac|acl)(?:[/._-]|$)/i;
const SCHEMA_PATH = /(?:^|\/)(?:migrations?|schema)(?:\/|\.|$)|(?:^|\/)db\/migrations\//i;
const CONFIG_PATH = /(?:^|\/)\.env(?:\.|$)|(?:^|\/)config(?:\/|\.|[-_])|[-_.]config\./i;

export function detectRiskSignals(
  files: { path: string; patch?: string | null }[],
): IntentRiskArea[] {
  const out: IntentRiskArea[] = [];
  const add = (label: string, kind: RiskKind) => {
    if (!out.some((r) => r.label === label)) out.push({ label, kind, source: 'heuristic' });
  };

  if (files.some((f) => AUTH_PATH.test(f.path))) add('Auth surface touched', 'auth');
  for (const f of files) {
    if (!/(?:^|\/)package\.json$/.test(f.path) || !f.patch) continue;
    for (const name of addedDependencies(f.patch)) add(`New dependency: ${name}`, 'dependency');
  }
  if (files.some((f) => SCHEMA_PATH.test(f.path))) add('Schema/migration change', 'data');
  if (files.some((f) => f.path.startsWith('.github/workflows/'))) add('CI pipeline changed', 'ci');
  if (files.some((f) => CONFIG_PATH.test(f.path))) add('Configuration changed', 'config');
  return out.slice(0, BUDGET.riskAreas);
}

/** Heuristic items first, model items after; case-insensitive dedupe; max 6. */
export function mergeRiskAreas(
  heuristic: IntentRiskArea[],
  model: { label: string; kind: RiskKind }[],
): IntentRiskArea[] {
  const seen = new Set<string>();
  const out: IntentRiskArea[] = [];
  const push = (r: IntentRiskArea) => {
    const key = r.label.trim().toLowerCase();
    if (key === '' || seen.has(key) || out.length >= BUDGET.riskAreas) return;
    seen.add(key);
    out.push(r);
  };
  for (const h of heuristic) push({ ...h, source: 'heuristic' });
  for (const m of model) push({ label: m.label.trim(), kind: m.kind, source: 'model' });
  return out;
}

// ------------------------------------------------------------------ patch → file

/**
 * Rebuild a file's content from its patch when the PR ADDED it (hunk header
 * `@@ -0,0 +1,N @@`). Returns `null` for modified/deleted files — the patch alone
 * can't reproduce them.
 */
export function addedFileContentFromPatch(patch: string | null | undefined): string | null {
  if (!patch || !/^@@ -0,0 \+/m.test(patch)) return null;
  const lines: string[] = [];
  let inHunk = false; // skip any `+++ b/…` file header before the first hunk
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (inHunk && line.startsWith('+')) lines.push(line.slice(1));
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ prompt text

/**
 * Neutralise untrusted text before it goes inside an `<untrusted>` block: drop
 * delimiter look-alikes (case-insensitive, repeated until stable so nested
 * fragments can't re-form one), strip control chars except \n and \t, cap length.
 */
export function sanitizeForPrompt(text: string, max: number): string {
  let s = text.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  let prev: string;
  do {
    prev = s;
    s = s.replace(/<\s*\/?\s*untrusted/gi, '');
  } while (s !== prev);
  return s.slice(0, max);
}

export function inputHash(i: {
  title: string;
  body: string | null;
  branch: string;
  headSha: string;
  provider: string;
  model: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: i.title,
        body: i.body ?? '',
        branch: i.branch,
        headSha: i.headSha,
        provider: i.provider,
        model: i.model,
        v: PROMPT_VERSION,
      }),
    )
    .digest('hex');
}

/** Plain-text block handed to reviewer-core's `intent` slot (it wraps + caps it). */
export function renderIntentForPrompt(r: PrIntentRecord): string {
  const kinds = [...new Set((r.sources ?? []).map((s) => s.kind))];
  const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  const parts = [
    `Intent: ${r.intent}`,
    `Confidence: ${r.confidence ?? 'low'}${kinds.length ? ` (sources: ${kinds.join(', ')})` : ''}`,
  ];
  if (r.in_scope.length) parts.push(`In scope:\n${list(r.in_scope)}`);
  if (r.out_of_scope.length) parts.push(`Out of scope:\n${list(r.out_of_scope)}`);
  const risks = (r.risk_areas ?? []).map((x) => x.label);
  if (risks.length) parts.push(`Risk areas:\n${list(risks)}`);
  return parts.join('\n');
}
