import { unzipSync } from 'fflate';
import type { Skill, SkillImportPreview, SkillSource, SkillType, SkillVersion } from '@devdigest/shared';
import { SkillType as SkillTypeSchema } from '@devdigest/shared';
import { AppError, ValidationError } from '../../platform/errors.js';
import type { SkillRow, SkillVersionRow } from './repository.js';
import {
  EXECUTABLE_EXTENSIONS,
  IGNORED_REASON,
  IMPORT_MAX_COMPRESSED_BYTES,
  IMPORT_MAX_SKILL_MD_BYTES,
  IMPORT_MAX_ZIP_ENTRIES,
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_DESCRIPTION_MIN,
  SKILL_MD_FILENAME,
  SKILL_NAME_MAX,
  SKILL_NAME_PATTERN,
  ZIP_MAGIC,
} from './constants.js';

export { formatSkillBlock, type SkillPromptFields } from '../_shared/skill-prompt.js';

// ---- DTO mapping ----

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow, agentCount?: number): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    ...(agentCount !== undefined ? { agent_count: agentCount } : {}),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Map a `skill_versions` row to the public `SkillVersion` DTO. Pre-L02 rows only
 * stored `body`, so name/description/type fall back to the skill's current values.
 */
export function toSkillVersionDto(row: SkillVersionRow, current: SkillRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    name: row.name ?? current.name,
    description: row.description ?? current.description,
    type: row.type ?? current.type,
    body: row.body,
    note: row.note ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

/** The versioned (snapshotted) part of a skill — everything but `enabled`. */
export interface SkillConfigFields {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/** True when a patch changes the skill's config (vs. only toggling `enabled`). */
export function isSkillConfigChange(
  existing: SkillConfigFields,
  patch: Partial<SkillConfigFields>,
): boolean {
  return (
    (patch.name !== undefined && patch.name !== existing.name) ||
    (patch.description !== undefined && patch.description !== existing.description) ||
    (patch.type !== undefined && patch.type !== existing.type) ||
    (patch.body !== undefined && patch.body !== existing.body)
  );
}

/** Escape `%`, `_` and `\` so user input is matched literally by ILIKE. */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** True for a Postgres unique-violation (drizzle may wrap the driver error in `cause`). */
export function isUniqueViolation(err: unknown, code: string): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === code || e?.cause?.code === code;
}

// ---- Import: errors ----

/** The uploaded file (or SKILL.md inside it) exceeds an import limit → 413. */
export class SkillImportTooLargeError extends AppError {
  constructor(message: string, details?: unknown) {
    super('payload_too_large', message, 413, details);
  }
}

// ---- Import: markdown ----

export interface ParsedSkillMarkdown {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  warnings: string[];
}

/** Lowercase kebab-case, `[a-z0-9-]` only, trimmed to the max name length. */
export function toKebabName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_NAME_MAX)
    .replace(/-+$/g, '');
}

/** File basename without directory and extension. */
function stem(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function unquote(v: string): string {
  const s = v.trim();
  if (s.length >= 2) {
    if (s.startsWith('"') && s.endsWith('"')) {
      return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    }
    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

/**
 * Minimal YAML-ish frontmatter parser: top-level `key: value` pairs, quoted
 * values, and `>` / `|` block scalars (indented continuation lines). Nested
 * structures are ignored — we only need name/description/type.
 */
export function parseFrontmatter(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const raw = m[2]!.trim();
    const block = /^([>|])[-+]?$/.exec(raw);
    if (block) {
      const parts: string[] = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]!) || lines[i + 1]!.trim() === '')) {
        parts.push(lines[++i]!.trim());
      }
      out[key] = (block[1] === '>' ? parts.join(' ').replace(/\s+/g, ' ') : parts.join('\n')).trim();
    } else {
      out[key] = unquote(raw.replace(/\s+#.*$/, ''));
    }
  }
  return out;
}

/**
 * Parse a skill markdown file: optional `---` frontmatter (`name`,
 * `description`, `type`) + body. Never throws on content problems — they become
 * warnings so the user can fix them in the preview.
 */
export function parseSkillMarkdown(markdown: string, fallbackName: string): ParsedSkillMarkdown {
  const warnings: string[] = [];
  const text = markdown.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  let meta: Record<string, string> = {};
  let body = text;
  const fm = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (fm) {
    meta = parseFrontmatter(fm[1]!);
    body = text.slice(fm[0].length);
  } else {
    warnings.push('No frontmatter found — name was derived from the filename.');
  }
  body = body.trim();

  const rawName = meta.name?.trim() || fallbackName;
  const name = toKebabName(rawName);
  if (meta.name && name !== meta.name.trim()) {
    warnings.push(`Name "${meta.name.trim()}" was normalized to "${name}".`);
  }
  if (!SKILL_NAME_PATTERN.test(name)) {
    warnings.push('Name must be 2–63 chars of lowercase letters, digits and dashes.');
  }

  const description = (meta.description ?? '').trim();
  if (!description) {
    warnings.push('Description is empty — describe when the agent should apply this skill.');
  } else if (description.length < SKILL_DESCRIPTION_MIN || description.length > SKILL_DESCRIPTION_MAX) {
    warnings.push(
      `Description must be ${SKILL_DESCRIPTION_MIN}–${SKILL_DESCRIPTION_MAX} characters (got ${description.length}).`,
    );
  }

  let type: SkillType = 'custom';
  if (meta.type !== undefined && meta.type.trim() !== '') {
    const parsed = SkillTypeSchema.safeParse(meta.type.trim().toLowerCase());
    if (parsed.success) type = parsed.data;
    else warnings.push(`Unknown type "${meta.type.trim()}" — using "custom".`);
  }

  if (!body) warnings.push('Skill body is empty.');
  else if (body.length > SKILL_BODY_MAX) {
    warnings.push(`Skill body exceeds ${SKILL_BODY_MAX} characters (got ${body.length}).`);
  }

  return { name, description, type, body, warnings };
}

// ---- Import: zip ----

export interface IgnoredFile {
  path: string;
  reason: string;
}

export interface ExtractedSkill {
  /** Path of the SKILL.md inside the archive. */
  path: string;
  markdown: string;
  ignored_files: IgnoredFile[];
}

export function isZip(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

function ignoredReason(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.zip')) return IGNORED_REASON.nestedArchive;
  if (EXECUTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return IGNORED_REASON.executable;
  return IGNORED_REASON.notSkillCore;
}

/** Depth of a SKILL.md candidate: 0 = archive root, 1 = one folder deep, else null. */
function skillMdDepth(path: string): 0 | 1 | null {
  const parts = path.split('/');
  if (parts[parts.length - 1]!.toLowerCase() !== SKILL_MD_FILENAME) return null;
  if (parts.length === 1) return 0;
  if (parts.length === 2 && parts[0] && parts[0] !== '__MACOSX') return 1;
  return null;
}

function decodeUtf8(bytes: Uint8Array, what: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ValidationError(`${what} is not valid UTF-8 text`);
  }
}

/**
 * Read ONLY `SKILL.md` (archive root, or exactly one folder deep) out of a zip,
 * fully in memory. Pass 1 lists the central directory with a filter that
 * decompresses nothing; pass 2 decompresses just the chosen entry (its declared
 * size is checked in the filter, and fflate inflates into a fixed buffer of that
 * size, so a lying header can't balloon memory). Nothing is written to disk or
 * executed; every other entry is reported in `ignored_files`.
 */
export function extractSkillFromZip(bytes: Uint8Array): ExtractedSkill {
  if (bytes.length > IMPORT_MAX_COMPRESSED_BYTES) {
    throw new SkillImportTooLargeError(
      `Archive exceeds ${IMPORT_MAX_COMPRESSED_BYTES} bytes`,
      { size: bytes.length, limit: IMPORT_MAX_COMPRESSED_BYTES },
    );
  }

  const files: { name: string; originalSize: number }[] = [];
  let entryCount = 0;
  try {
    unzipSync(bytes, {
      filter: (f) => {
        entryCount++;
        if (entryCount <= IMPORT_MAX_ZIP_ENTRIES && !f.name.endsWith('/')) {
          files.push({ name: f.name, originalSize: f.originalSize });
        }
        return false;
      },
    });
  } catch {
    throw new ValidationError('File is not a valid zip archive');
  }
  if (entryCount > IMPORT_MAX_ZIP_ENTRIES) {
    throw new SkillImportTooLargeError(`Archive has more than ${IMPORT_MAX_ZIP_ENTRIES} entries`, {
      entries: entryCount,
      limit: IMPORT_MAX_ZIP_ENTRIES,
    });
  }

  const candidates = files
    .map((f) => ({ ...f, depth: skillMdDepth(f.name) }))
    .filter((f): f is typeof f & { depth: 0 | 1 } => f.depth !== null);
  const root = candidates.filter((c) => c.depth === 0);
  const nested = candidates.filter((c) => c.depth === 1);
  if (candidates.length === 0) {
    throw new ValidationError('No SKILL.md found at the archive root or one folder deep');
  }
  if (root.length === 0 && nested.length > 1) {
    throw new ValidationError('Archive contains several SKILL.md files — expected exactly one', {
      paths: nested.map((n) => n.name),
    });
  }
  const chosen = (root[0] ?? nested[0])!;
  if (chosen.originalSize > IMPORT_MAX_SKILL_MD_BYTES) {
    throw new SkillImportTooLargeError(`SKILL.md exceeds ${IMPORT_MAX_SKILL_MD_BYTES} bytes`, {
      size: chosen.originalSize,
      limit: IMPORT_MAX_SKILL_MD_BYTES,
    });
  }

  let out: Record<string, Uint8Array>;
  try {
    out = unzipSync(bytes, {
      filter: (f) => f.name === chosen.name && f.originalSize <= IMPORT_MAX_SKILL_MD_BYTES,
    });
  } catch {
    throw new ValidationError('SKILL.md could not be decompressed');
  }
  const data = out[chosen.name];
  if (!data) throw new ValidationError('SKILL.md could not be decompressed');
  if (data.length > IMPORT_MAX_SKILL_MD_BYTES) {
    throw new SkillImportTooLargeError(`SKILL.md exceeds ${IMPORT_MAX_SKILL_MD_BYTES} bytes`);
  }

  return {
    path: chosen.name,
    markdown: decodeUtf8(data, 'SKILL.md'),
    ignored_files: files
      .filter((f) => f.name !== chosen.name)
      .map((f) => ({ path: f.name, reason: ignoredReason(f.name) })),
  };
}

/**
 * Build the import preview for an uploaded `.md` or `.zip` (detected by magic
 * bytes, then extension). Pure: persists nothing; `conflict` is resolved by the
 * service against the workspace.
 */
export function buildImportPreview(
  filename: string,
  bytes: Uint8Array,
): Omit<SkillImportPreview, 'conflict'> {
  if (bytes.length === 0) throw new ValidationError('Uploaded file is empty');
  const lower = filename.toLowerCase();

  if (isZip(bytes)) {
    const extracted = extractSkillFromZip(bytes);
    const parts = extracted.path.split('/');
    const fallback = parts.length > 1 ? parts[0]! : stem(filename);
    const parsed = parseSkillMarkdown(extracted.markdown, fallback);
    return { ...parsed, ignored_files: extracted.ignored_files };
  }
  if (lower.endsWith('.zip')) throw new ValidationError('File is not a valid zip archive');
  if (!/\.(md|markdown)$/.test(lower)) {
    throw new ValidationError('Unsupported file type — upload a .md or .zip file');
  }
  if (bytes.length > IMPORT_MAX_SKILL_MD_BYTES) {
    throw new SkillImportTooLargeError(`Markdown file exceeds ${IMPORT_MAX_SKILL_MD_BYTES} bytes`, {
      size: bytes.length,
      limit: IMPORT_MAX_SKILL_MD_BYTES,
    });
  }
  const parsed = parseSkillMarkdown(decodeUtf8(bytes, 'Markdown file'), stem(filename));
  return { ...parsed, ignored_files: [] };
}
