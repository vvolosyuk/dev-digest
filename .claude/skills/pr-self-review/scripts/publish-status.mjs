#!/usr/bin/env node
/**
 * Publishes the last /pr-self-review verdict as a GitHub commit status
 * (context `pr-self-review`) on the current HEAD. Informational: a status only
 * blocks merging if the repo owner configures a ruleset that requires it.
 *
 * Posts only when it is truthful: the review result must still match the code
 * (fingerprint), the working tree must be clean, and HEAD must be on the remote.
 * Prints one JSON line {published, reason?, sha?, state?}; always exits 0 so a
 * missing `gh` never turns a review into a crash.
 *
 * Usage: node .claude/skills/pr-self-review/scripts/publish-status.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeFingerprint } from './fingerprint.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const done = (payload) => {
  console.log(JSON.stringify(payload));
  process.exit(0);
};

const STATE = { PASS: 'success', BLOCKED: 'failure', INCOMPLETE: 'error' };

function main() {
  const root = run('git', ['rev-parse', '--show-toplevel']);
  let result;
  try {
    result = JSON.parse(readFileSync(join(root, '.claude/pr-self-review/last-result.json'), 'utf8'));
  } catch {
    return done({ published: false, reason: 'no last-result.json — run /pr-self-review first' });
  }

  const state = STATE[result.verdict];
  if (!state) return done({ published: false, reason: `unknown verdict ${result.verdict}` });

  if (computeFingerprint(result.mergeBase) !== result.fingerprint) {
    return done({ published: false, reason: 'code changed since the review — re-run /pr-self-review' });
  }
  if (run('git', ['status', '--porcelain'])) {
    return done({ published: false, reason: 'uncommitted changes — commit and push, then re-run this script (no new review needed if nothing else changes)' });
  }

  const sha = run('git', ['rev-parse', 'HEAD']);
  let onRemote = false;
  try {
    onRemote = run('git', ['branch', '-r', '--contains', sha]).length > 0;
  } catch {
    /* treated as not pushed */
  }
  if (!onRemote) return done({ published: false, reason: 'HEAD is not pushed — `git push`, then re-run this script' });

  try {
    run('gh', ['--version']);
  } catch {
    return done({ published: false, reason: '`gh` CLI not found — install GitHub CLI and run `gh auth login`' });
  }

  const description =
    result.verdict === 'BLOCKED'
      ? `${result.criticalCount} critical finding(s) — fix before merging`
      : result.verdict === 'PASS'
        ? 'No critical findings'
        : 'Review incomplete';

  try {
    const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
    run('gh', ['api', `repos/${repo}/statuses/${sha}`, '-f', `state=${state}`, '-f', 'context=pr-self-review', '-f', `description=${description}`]);
    return done({ published: true, sha, state, repo });
  } catch (err) {
    return done({ published: false, reason: `gh api failed: ${String(err.stderr || err.message).trim().split('\n')[0]}` });
  }
}

try {
  main();
} catch (err) {
  done({ published: false, reason: String(err.message).split('\n')[0] });
}
