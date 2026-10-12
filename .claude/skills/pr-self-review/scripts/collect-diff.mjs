#!/usr/bin/env node
/**
 * Collects everything that would go into a pull request (branch commits since
 * the merge-base + staged + unstaged + untracked files), drops files that must
 * not be reviewed, and routes the rest to review skills using
 * `../references/routing.json`. Prints one JSON document to stdout; the
 * pr-self-review skill consumes it. Read-only: never modifies the repo.
 *
 * Usage: node .claude/skills/pr-self-review/scripts/collect-diff.mjs [--base <ref>] [--chunk <n>]
 *   --base   ref to compare against (default: origin/main, then main)
 *   --chunk  max files per (skill) review task (default 15)
 * Exit code: 0 = JSON written (even when the diff is empty), 2 = fatal error (message on stderr).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFingerprint } from './fingerprint.mjs';

const MAX_CONTENT_BYTES = 1024 * 1024;
const here = fileURLToPath(new URL('.', import.meta.url));
const routing = JSON.parse(readFileSync(join(here, '../references/routing.json'), 'utf8'));

function fail(message) {
  console.error(`collect-diff: ${message}`);
  process.exit(2);
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (allowFail) return null;
    fail(`git ${args.join(' ')} failed: ${String(err.stderr || err.message).trim()}`);
  }
}

function parseArgs(argv) {
  const opts = { base: null, chunk: 15 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') opts.base = argv[++i];
    else if (argv[i] === '--chunk') opts.chunk = Number(argv[++i]) || 15;
    else fail(`unknown argument ${argv[i]}`);
  }
  return opts;
}

/** Minimal glob -> RegExp: `**` any depth, `*` within a segment, `?`, `{a,b}`. */
function globToRegExp(glob) {
  let re = '';
  let braceDepth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      re += '(?:';
      braceDepth++;
    } else if (c === '}' && braceDepth > 0) {
      re += ')';
      braceDepth--;
    } else if (c === ',' && braceDepth > 0) re += '|';
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const compile = (globs = []) => globs.map(globToRegExp);
const matchesAny = (regexes, path) => regexes.some((r) => r.test(path));

const excludeRules = routing.exclude.map((r) => ({ ...r, re: globToRegExp(r.glob) }));
const skillRules = routing.rules.map((r) => ({
  ...r,
  includeRe: compile(r.include),
  excludeRe: compile(r.exclude),
  contentRe: r.contentPattern ? new RegExp(r.contentPattern, 'i') : null,
}));
const binaryExt = new Set(routing.binaryExtensions);

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = git(['rev-parse', '--show-toplevel']).trim();
  process.chdir(root);

  const base =
    opts.base ?? ['origin/main', 'main'].find((ref) => git(['rev-parse', '--verify', '--quiet', ref], { allowFail: true }) !== null);
  if (!base) fail('could not find a base ref (tried origin/main, main); pass --base <ref>');

  const mergeBase = (git(['merge-base', 'HEAD', base], { allowFail: true }) ?? '').trim();
  if (!mergeBase) fail(`no merge-base between HEAD and ${base}; pass --base <ref>`);

  const headSha = git(['rev-parse', 'HEAD']).trim();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const dirty = git(['status', '--porcelain']).trim().length > 0;
  const onRemote = (git(['branch', '-r', '--contains', headSha], { allowFail: true }) ?? '').trim().length > 0;

  // Tracked changes: merge-base -> working tree (commits + staged + unstaged).
  const files = new Map();
  const tokens = git(['diff', '--name-status', '-z', '-M', mergeBase]).split('\0');
  for (let i = 0; i < tokens.length - 1; ) {
    const status = tokens[i++];
    if (!status) continue;
    const letter = status[0];
    if (letter === 'R' || letter === 'C') {
      const oldPath = tokens[i++];
      const path = tokens[i++];
      files.set(path, { path, status: letter, oldPath, untracked: false });
    } else {
      const path = tokens[i++];
      files.set(path, { path, status: letter, untracked: false });
    }
  }
  // Untracked (not ignored) files are part of "all open changes" too.
  for (const path of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')) {
    if (path && !files.has(path)) files.set(path, { path, status: 'A', untracked: true });
  }

  const warnings = [];
  const excluded = [];
  const deleted = [];
  const unrouted = [];
  const reviewed = [];
  const bySkill = new Map();

  for (const file of [...files.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const { path } = file;
    if (file.status === 'D') {
      deleted.push(path);
      continue;
    }
    const rule = excludeRules.find((r) => r.re.test(path));
    if (rule) {
      excluded.push({ path, level: rule.level, reason: rule.reason });
      if (rule.level === 'warn') warnings.push(`${path} — ${rule.reason}`);
      continue;
    }
    if (binaryExt.has(extname(path).slice(1).toLowerCase())) {
      excluded.push({ path, level: 'skip', reason: 'binary/asset file' });
      continue;
    }

    let content = null;
    if (existsSync(path) && statSync(path).isFile()) {
      if (statSync(path).size <= MAX_CONTENT_BYTES) content = readFileSync(path, 'utf8');
      else warnings.push(`${path} — larger than 1 MB, content-triggered skills may be missed`);
    }

    const skills = [];
    for (const r of skillRules) {
      if (!matchesAny(r.includeRe, path) || matchesAny(r.excludeRe, path)) continue;
      if (r.contentRe && !(content !== null && r.contentRe.test(content))) continue;
      if (skills.some((s) => s.skill === r.skill)) continue;
      skills.push({ skill: r.skill, group: r.group });
    }
    const entry = { ...file, skills: skills.map((s) => s.skill) };
    if (skills.length === 0) {
      unrouted.push(path);
      continue;
    }
    reviewed.push(entry);
    for (const s of skills) {
      if (!bySkill.has(s.skill)) bySkill.set(s.skill, { skill: s.skill, group: s.group, files: [] });
      bySkill.get(s.skill).files.push(path);
    }
  }

  // One review task per skill, chunked so no single subagent drowns in files.
  const tasks = [];
  for (const { skill, group, files: skillFiles } of bySkill.values()) {
    const chunks = Math.ceil(skillFiles.length / opts.chunk);
    for (let c = 0; c < chunks; c++) {
      tasks.push({ skill, group, chunk: c + 1, chunks, files: skillFiles.slice(c * opts.chunk, (c + 1) * opts.chunk) });
    }
  }

  // Skills that exist on disk but have no routing rule: surface instead of silently skipping.
  const routedSkills = new Set(skillRules.map((r) => r.skill));
  const skillsDir = join(root, '.claude/skills');
  const unroutedSkills = existsSync(skillsDir)
    ? readdirSync(skillsDir).filter(
        (name) =>
          existsSync(join(skillsDir, name, 'SKILL.md')) && !routedSkills.has(name) && !routing.ignoreSkills.includes(name),
      )
    : [];
  const skillsWithoutFiles = [...routedSkills].filter((s) => !bySkill.has(s));

  const out = {
    branch,
    base,
    mergeBase,
    headSha,
    fingerprint: computeFingerprint(mergeBase),
    dirty,
    onRemote,
    empty: reviewed.length === 0 && unrouted.length === 0 && excluded.length === 0 && deleted.length === 0,
    counts: { changed: files.size, reviewed: reviewed.length, excluded: excluded.length, deleted: deleted.length, unrouted: unrouted.length },
    files: reviewed,
    tasks,
    skillsWithoutFiles,
    unroutedSkills,
    unrouted,
    deleted,
    excluded,
    warnings,
    diffHint: `git diff ${mergeBase} -- <file>   (untracked files: read the file whole)`,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main();
