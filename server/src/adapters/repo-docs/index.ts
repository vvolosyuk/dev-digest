/**
 * repo-docs adapter — read ONE markdown doc from a repo at a specific commit.
 *
 * Server-local port (like Tokenizer / DepGraph): the vendored `GitClient.readFile`
 * reads the default-branch WORKING TREE (not the PR head) and joins the path
 * unvalidated, so the intent layer cannot use it for attacker-controlled paths.
 * This reader runs `git show <sha>:<path>` through an argument array (never a
 * shell string) inside the existing clone, after re-validating both inputs.
 *
 * Scope: in-process, ONLY the intent module. Swappable in tests via
 * `ContainerOverrides.repoDocs` (see `MockRepoDocReader` in adapters/mocks.ts).
 */
import { simpleGit } from 'simple-git';
import type { GitClient, RepoRef } from '@devdigest/shared';

export interface RepoDocReader {
  /** Doc text at `ref:path` truncated to `maxBytes`, or `null` if unreadable/unsafe. */
  readAtRef(repo: RepoRef, ref: string, path: string, maxBytes: number): Promise<string | null>;
}

const SHA_RE = /^[0-9a-f]{7,40}$/;
const DOC_EXT_RE = /\.(md|mdx)$/i;
const BLOCKED_PREFIXES = ['node_modules/', '.git/', 'server/clones/'];
const MAX_PATH_LEN = 300;

/** Only a hex commit id may reach `git show` (no refs, no options, no `..`). */
export function isSafeRef(ref: string): boolean {
  return SHA_RE.test(ref);
}

/**
 * Allow-list for doc paths: repo-relative POSIX `.md` / `.mdx` only. A leading
 * `/` or `./` is tolerated and stripped by `normalizeDocPath`; everything else
 * that could escape the repo (`..`, backslashes, drive letters, NUL) is rejected.
 */
export function normalizeDocPath(path: string): string | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LEN) return null;
  if (path.includes('\0') || path.includes('\\')) return null;
  const stripped = path.replace(/^(\.\/|\/)+/, '');
  if (stripped.length === 0 || /^[a-zA-Z]:/.test(stripped)) return null;
  const segments = stripped.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null;
  if (!DOC_EXT_RE.test(stripped)) return null;
  const lower = stripped.toLowerCase();
  if (BLOCKED_PREFIXES.some((p) => lower.startsWith(p) || lower.includes(`/${p}`))) return null;
  return stripped;
}

export function isSafeDocPath(path: string): boolean {
  return normalizeDocPath(path) !== null;
}

export class SimpleGitDocReader implements RepoDocReader {
  constructor(private git: GitClient) {}

  async readAtRef(
    repo: RepoRef,
    ref: string,
    path: string,
    maxBytes: number,
  ): Promise<string | null> {
    const safePath = normalizeDocPath(path);
    if (!isSafeRef(ref) || safePath === null) return null;
    try {
      const out = await simpleGit(this.git.clonePathFor(repo)).raw(['show', `${ref}:${safePath}`]);
      return Buffer.byteLength(out, 'utf8') > maxBytes
        ? Buffer.from(out, 'utf8').subarray(0, maxBytes).toString('utf8')
        : out;
    } catch {
      return null;
    }
  }
}
