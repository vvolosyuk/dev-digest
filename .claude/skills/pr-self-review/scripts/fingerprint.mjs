/**
 * Content fingerprint of "everything that would go into the PR": the diff from
 * the merge-base to the working tree plus the content of untracked files.
 * Content-based on purpose — committing the already-reviewed changes does not
 * change it, but editing any reviewed line does. Shared by collect-diff.mjs
 * (records it in the result) and pre-pr-guard.mjs (detects a stale result).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const git = (args) =>
  execFileSync('git', args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

export function computeFingerprint(mergeBase) {
  const hash = createHash('sha256');
  hash.update(git(['diff', '--no-color', mergeBase]));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const path of untracked) {
    hash.update(`\0untracked:${path}\0`);
    try {
      hash.update(readFileSync(path));
    } catch {
      /* file vanished between listing and reading — fingerprint stays deterministic enough */
    }
  }
  return hash.digest('hex');
}
