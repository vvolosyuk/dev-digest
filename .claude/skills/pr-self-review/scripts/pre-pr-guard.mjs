#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: refuses `gh pr create` unless the last
 * /pr-self-review run passed on exactly the changes that are about to be
 * submitted. Reads the hook payload (JSON) from stdin; exit 2 = block (message
 * on stderr is shown to Claude), exit 0 = allow. Any other command is allowed.
 *
 * Only guards PRs opened through Claude. It does not stop a PR opened in the
 * browser/terminal, and it does not block merging on GitHub.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { computeFingerprint } from './fingerprint.mjs';

const block = (message) => {
  console.error(`pr-self-review: ${message}`);
  process.exit(2);
};

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // not a hook payload — never get in the way
}

const command = String(payload?.tool_input?.command ?? '');
// Match an actual invocation (start of the command or after ; & | ( newline, optional `&`/VAR=x prefix),
// not the text "gh pr create" quoted inside an echo/commit message.
if (!/(?:^|[;&|(\n])\s*(?:&\s+)?(?:\w+=\S+\s+)*gh\s+pr\s+create\b/.test(command)) process.exit(0);

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

let root;
try {
  root = git(['rev-parse', '--show-toplevel']);
} catch {
  process.exit(0);
}

let result;
try {
  result = JSON.parse(readFileSync(join(root, '.claude/pr-self-review/last-result.json'), 'utf8'));
} catch {
  block('no review result found. Run /pr-self-review first, then open the PR.');
}

if (result.verdict === 'BLOCKED') {
  block(`last review found ${result.criticalCount} CRITICAL finding(s). Fix them and re-run /pr-self-review before opening the PR.`);
}
if (result.verdict !== 'PASS') {
  block(`last review verdict was ${result.verdict} (not PASS). Re-run /pr-self-review until it passes.`);
}

let current;
try {
  current = computeFingerprint(result.mergeBase);
} catch (err) {
  block(`could not verify that the review is current (${String(err.message).split('\n')[0]}). Re-run /pr-self-review.`);
}
if (current !== result.fingerprint) {
  block('the code changed after the last review (stale result). Re-run /pr-self-review before opening the PR.');
}
process.exit(0);
