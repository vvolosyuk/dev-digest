#!/usr/bin/env node
// PreToolUse guard for the project subagents.
// Usage (from agent frontmatter): node guard.mjs <mode>
//   planner | implementer-files | implementer-bash
//   test-writer-files | test-writer-bash | verifier-bash | readonly-git | doc-writer
// Reads the hook JSON from stdin. Exit 0 = allow, exit 2 = block (stderr is fed back to the agent).
// Fails closed: unparsable input or an unknown mode blocks.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mode = process.argv[2];

function block(reason) {
  process.stderr.write(`[guard:${mode}] BLOCKED — ${reason}\n`);
  process.exit(2);
}

/** Repo-relative, forward-slash, lower-case path; null if outside the repo. */
function rel(p, cwd) {
  if (!p) return null;
  const abs = path.resolve(cwd || REPO_ROOT, p);
  const r = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
  if (r.startsWith("..") || path.isAbsolute(r)) return null;
  return r.toLowerCase();
}

// Paths the implementer must never edit (see root + module CLAUDE.md "Do not touch").
const PROTECTED = [
  [/^(client|server)\/src\/vendor\//, "vendored package — change it at the source lesson, not here"],
  [/^server\/src\/db\/migrations\//, "generated migrations — add a NEW one via `pnpm db:generate`, never edit existing"],
  [/(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/, "lock file — regenerate via install, never hand-edit"],
  [/^server\/clones\//, "git-ignored runtime data"],
  [/^server\/package\.json$/, "skip-worktree file with a local variant — ask the user"],
  [/^docs\/plans\//, "the plan is read-only for the implementer — report deviations instead"],
  [/^\.claude\//, "agent/hook/skill config is out of scope for the implementer"],
];

// Shell commands the implementer must never run.
const BANNED_CMDS = [
  [/\bgit\s+(commit|push|reset\s+--hard|clean\b|rebase|checkout\s+--|restore\b|stash\b|branch\s+-D)/, "git history/working-tree mutation — the user commits"],
  [/\bdocker\s+(compose\s+down\b[^|;&]*\s-v\b|volume\s+(rm|prune))/, "deletes the dev DB volume"],
  [/\brm\s+-[a-z]*r/i, "recursive delete"],
  [/\b(pnpm|npm)\s+(i|install|add|remove|rm|uninstall|ci|update|up)\b/, "dependency/lockfile change — return BLOCKED and let the main session install"],
  [/\b(db:migrate|db:seed|drizzle-kit\s+(push|migrate))\b/, "touches the dev database — migrations are run manually by the user"],
];

// test-writer: test files it may create or edit (lower-case, repo-relative).
const TEST_FILES = [
  /^client\/src\/.+\.test\.tsx?$/,
  /^server\/(src|test)\/.+\.test\.ts$/,
  /^reviewer-core\/(src|test)\/.+\.test\.ts$/,
  /^(client|server|reviewer-core)\/insights\.md$/,
];
// test-writer: shared helpers it may only create (never edit an existing one).
const TEST_HELPERS_CREATE_ONLY = [/^server\/test\/helpers\/[^/]+\.ts$/, /^client\/src\/test\/[^/]+\.tsx?$/];

// doc-writer: Markdown docs it may write.
const DOC_FILES = [
  /^(client|server|reviewer-core)\/(docs|specs)\/[^/]+\.md$/,
  /^e2e\/docs\/[^/]+\.md$/,
  /^(client|server|reviewer-core|e2e)\/readme\.md$/,
  /^(readme|testing)\.md$/,
];

// Any shell metacharacter that could chain, redirect or substitute.
const SHELL_META = /[;&|<>`$()\n\r]/;

/** Read-only git inspection, nothing chained or redirected. */
function isReadOnlyGit(cmd) {
  const c = cmd.trim();
  return (
    /^git\s+(diff|log|show|status|ls-files|merge-base|rev-parse|blame|grep)(\s|$)/.test(c) &&
    !SHELL_META.test(c) &&
    !/--(output|ext-diff|open-files-in-pager)\b/.test(c) &&
    !/(^|\s)-[a-zA-Z]*O/.test(c) // git grep -O<cmd> runs a program
  );
}

/** A package test/typecheck run, optionally `cd <pkg> && … 2>&1`. No watch, no snapshot update. */
function isTestRun(cmd, { e2e }) {
  const c = cmd
    .trim()
    .replace(/^cd\s+(client|server|reviewer-core|e2e)\s+&&\s+/, "")
    .replace(/\s+2>&1$/, "");
  if (SHELL_META.test(c)) return false;
  if (/(^|\s)(-u|--update|--watch|--outputFile)(\s|=|$)/.test(c)) return false;
  return (
    /^(pnpm|npm)\s+(run\s+)?(test|typecheck)$/.test(c) ||
    /^pnpm\s+exec\s+vitest\s+run(\s.*)?$/.test(c) ||
    /^npx\s+vitest\s+run(\s.*)?$/.test(c) ||
    (e2e && /^npm\s+run\s+e2e:hermetic$/.test(c))
  );
}

const GIT_FORMS = "git diff|log|show|status|ls-files|merge-base|rev-parse|blame|grep (no ; & | > $ ( ) `, no --output, no -O)";
const TEST_FORMS =
  "[cd client|server|reviewer-core && ] pnpm test | pnpm typecheck | pnpm exec vitest run [args] | npx vitest run [args] [2>&1] (no -u, no watch)";

// Shell write operators — combined with a protected path they mean "editing it via Bash".
const SHELL_WRITE = /(>|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|Set-Content|Out-File)/;

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  block("could not parse hook input");
}
const ti = input.tool_input || {};
const cwd = input.cwd;

switch (mode) {
  case "planner": {
    const r = rel(ti.file_path, cwd);
    if (!r || !/^docs\/plans\/[^/]+\.md$/.test(r)) {
      block(`planner may only write docs/plans/<file>.md (got: ${ti.file_path})`);
    }
    break;
  }
  case "implementer-files": {
    const r = rel(ti.file_path || ti.notebook_path, cwd);
    if (!r) block(`path is outside the repository (${ti.file_path})`);
    for (const [re, why] of PROTECTED) if (re.test(r)) block(`${r}: ${why}`);
    break;
  }
  case "implementer-bash": {
    const cmd = String(ti.command || "");
    for (const [re, why] of BANNED_CMDS) if (re.test(cmd)) block(`\`${cmd}\`: ${why}`);
    if (SHELL_WRITE.test(cmd)) {
      const norm = cmd.replace(/\\/g, "/").toLowerCase();
      const hit = PROTECTED.find(([re]) =>
        norm.split(/[\s"'`;&|()<>]+/).some((tok) => {
          const r = rel(tok, cwd);
          return r && re.test(r);
        }),
      );
      if (hit) block(`\`${cmd}\` writes to a protected path: ${hit[1]}`);
    }
    break;
  }
  case "test-writer-files": {
    const fp = ti.file_path || ti.notebook_path;
    const r = rel(fp, cwd);
    if (!r) block(`path is outside the repository (${fp})`);
    for (const [re, why] of PROTECTED) if (re.test(r)) block(`${r}: ${why}`);
    if (TEST_FILES.some((re) => re.test(r))) break;
    if (TEST_HELPERS_CREATE_ONLY.some((re) => re.test(r))) {
      if (input.tool_name === "Write" && !existsSync(path.resolve(cwd || REPO_ROOT, fp))) break;
      block(`${r}: existing shared test helpers are read-only — create a new helper file instead`);
    }
    block(`${r}: test-writer may only edit test files — report production bugs instead of fixing them`);
    break;
  }
  case "doc-writer": {
    const fp = ti.file_path || ti.notebook_path;
    const r = rel(fp, cwd);
    if (!r || !DOC_FILES.some((re) => re.test(r))) {
      block(
        `doc-writer may only write <module>/docs|specs/*.md, e2e/docs/*.md, module README.md, README.md, TESTING.md (got: ${fp})`,
      );
    }
    break;
  }
  case "readonly-git": {
    const cmd = String(ti.command || "");
    if (!isReadOnlyGit(cmd)) block(`\`${cmd}\`: only read-only git is allowed — ${GIT_FORMS}`);
    break;
  }
  case "test-writer-bash": {
    const cmd = String(ti.command || "");
    if (!isReadOnlyGit(cmd) && !isTestRun(cmd, { e2e: false })) {
      block(`\`${cmd}\`: allowed — ${TEST_FORMS}; ${GIT_FORMS}`);
    }
    break;
  }
  case "verifier-bash": {
    const cmd = String(ti.command || "");
    if (!isReadOnlyGit(cmd) && !isTestRun(cmd, { e2e: true })) {
      block(`\`${cmd}\`: allowed — ${TEST_FORMS}; cd e2e && npm run e2e:hermetic; ${GIT_FORMS}`);
    }
    break;
  }
  default:
    block(`unknown guard mode "${mode}"`);
}
process.exit(0);
