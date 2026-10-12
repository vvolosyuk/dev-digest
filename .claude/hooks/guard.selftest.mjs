#!/usr/bin/env node
// Self-test for guard.mjs — run: node .claude/hooks/guard.selftest.mjs
// Feeds hook JSON to each mode and checks the exit code (0 = allow, 2 = block). Exits 1 on any mismatch.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, "guard.mjs");
const REPO_ROOT = path.resolve(HERE, "..", "..");
const ALLOW = 0;
const BLOCK = 2;

const file = (mode, file_path, expect, tool_name = "Edit") => ({ mode, tool_name, tool_input: { file_path }, expect });
const write = (mode, file_path, expect) => file(mode, file_path, expect, "Write");
const bash = (mode, command, expect) => ({ mode, tool_name: "Bash", tool_input: { command }, expect });

const CASES = [
  // Regression: existing modes behave as before.
  write("planner", "docs/plans/x.md", ALLOW),
  write("planner", "docs/x.md", BLOCK),
  file("implementer-files", "server/src/vendor/shared/a.ts", BLOCK),
  file("implementer-files", ".claude/agents/x.md", BLOCK),
  file("implementer-files", "server/src/modules/a/routes.ts", ALLOW),
  bash("implementer-bash", "git commit -m x", BLOCK),
  bash("implementer-bash", "cd server && pnpm typecheck", ALLOW),
  file("no-such-mode", "README.md", BLOCK),
  { mode: "planner", raw: "not json", expect: BLOCK },

  // test-writer-files
  file("test-writer-files", "client/src/components/X/X.test.tsx", ALLOW),
  file("test-writer-files", "server/test/foo.it.test.ts", ALLOW),
  file("test-writer-files", "reviewer-core/test/prompt.test.ts", ALLOW),
  file("test-writer-files", "server/INSIGHTS.md", ALLOW),
  file("test-writer-files", path.join(REPO_ROOT, "server", "test", "abs-path.test.ts"), ALLOW),
  file("test-writer-files", "client/src/components/X/X.tsx", BLOCK),
  file("test-writer-files", "server/src/modules/pulls/routes.ts", BLOCK),
  file("test-writer-files", "client/src/vendor/ui/a.test.tsx", BLOCK),
  file("test-writer-files", "e2e/specs/01-x.flow.json", BLOCK),
  file("test-writer-files", "client/src/test/setup.ts", BLOCK),
  write("test-writer-files", "server/test/helpers/pg.ts", BLOCK),
  write("test-writer-files", "server/test/helpers/new-fixture.ts", ALLOW),
  file("test-writer-files", "server/test/helpers/new-fixture.ts", BLOCK),
  file("test-writer-files", "../outside.test.ts", BLOCK),

  // doc-writer
  write("doc-writer", "server/specs/new.md", ALLOW),
  write("doc-writer", "client/docs/adr-005-x.md", ALLOW),
  file("doc-writer", "README.md", ALLOW),
  file("doc-writer", "TESTING.md", ALLOW),
  file("doc-writer", "reviewer-core/README.md", ALLOW),
  file("doc-writer", "e2e/docs/README.md", ALLOW),
  file("doc-writer", "client/CLAUDE.md", BLOCK),
  file("doc-writer", "server/INSIGHTS.md", BLOCK),
  write("doc-writer", "docs/plans/a.md", BLOCK),
  file("doc-writer", "docs/agent-prompts/general-reviewer.md", BLOCK),
  file("doc-writer", "e2e/specs/01-a.flow.json", BLOCK),
  file("doc-writer", "server/src/app.ts", BLOCK),
  write("doc-writer", ".claude/agents/x.md", BLOCK),

  // readonly-git
  bash("readonly-git", "git diff --name-status main...HEAD", ALLOW),
  bash("readonly-git", "git status --porcelain", ALLOW),
  bash("readonly-git", "git ls-files client/src/app", ALLOW),
  bash("readonly-git", "git checkout -- x", BLOCK),
  bash("readonly-git", "git diff > out.txt", BLOCK),
  bash("readonly-git", "git diff --output=x", BLOCK),
  bash("readonly-git", "git log; rm -rf x", BLOCK),
  bash("readonly-git", "git log $(rm -rf x)", BLOCK),
  bash("readonly-git", "git grep -n groundFindings reviewer-core/src", ALLOW),
  bash("readonly-git", "git grep -Ovim foo", BLOCK),
  bash("readonly-git", "git grep --open-files-in-pager=sh foo", BLOCK),
  bash("readonly-git", "ls", BLOCK),
  bash("readonly-git", "pnpm test", BLOCK),

  // test-writer-bash
  bash("test-writer-bash", "cd server && pnpm exec vitest run test/pulls-status.test.ts", ALLOW),
  bash("test-writer-bash", "cd client && pnpm test", ALLOW),
  bash("test-writer-bash", "cd server && pnpm exec vitest run --exclude '**/*.it.test.ts' 2>&1", ALLOW),
  bash("test-writer-bash", "cd reviewer-core && npm test", ALLOW),
  bash("test-writer-bash", "git diff", ALLOW),
  bash("test-writer-bash", "cd client && pnpm exec vitest run -u", BLOCK),
  bash("test-writer-bash", "cd client && pnpm exec vitest run --update", BLOCK),
  bash("test-writer-bash", "pnpm install", BLOCK),
  bash("test-writer-bash", "cd e2e && npm run e2e:hermetic", BLOCK),
  bash("test-writer-bash", "cd server && pnpm db:migrate", BLOCK),
  bash("test-writer-bash", "cd client && pnpm exec vitest", BLOCK),
  bash("test-writer-bash", "cd server && pnpm test && rm -rf src", BLOCK),

  // verifier-bash
  bash("verifier-bash", "cd server && pnpm typecheck", ALLOW),
  bash("verifier-bash", "cd server && pnpm exec vitest run test/pulls-status.test.ts", ALLOW),
  bash("verifier-bash", "cd client && pnpm test", ALLOW),
  bash("verifier-bash", "cd server && pnpm exec vitest run --exclude '**/*.it.test.ts' 2>&1", ALLOW),
  bash("verifier-bash", "cd e2e && npm run e2e:hermetic", ALLOW),
  bash("verifier-bash", "git log --oneline -5", ALLOW),
  bash("verifier-bash", "sed -i s/a/b/ x", BLOCK),
  bash("verifier-bash", "cd client && pnpm exec vitest run -u", BLOCK),
];

let failed = 0;
for (const c of CASES) {
  const stdin = c.raw ?? JSON.stringify({ tool_name: c.tool_name, tool_input: c.tool_input, cwd: REPO_ROOT });
  const res = spawnSync(process.execPath, [GUARD, c.mode], { input: stdin, encoding: "utf8" });
  const ok = res.status === c.expect;
  if (!ok) failed++;
  const what = c.raw ? "<raw>" : c.tool_input.file_path ?? c.tool_input.command;
  const exp = c.expect === ALLOW ? "allow" : "block";
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.mode.padEnd(18)} ${(c.tool_name ?? "").padEnd(5)} ${exp.padEnd(5)}  ${what}${ok ? "" : `  (exit ${res.status}: ${res.stderr.trim()})`}`);
}
console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
