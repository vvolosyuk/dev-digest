---
name: pr-self-review
description: Pre-PR self review of all local changes (branch commits + staged + unstaged + untracked). Routes the diff to the project's review skills — UI skills only on client files, backend/architecture skills only on server and reviewer-core files — and returns a PASS / BLOCKED / INCOMPLETE verdict. Any CRITICAL finding means BLOCKED: do not open or merge the PR. Report only; applies no fixes. Run before every `gh pr create` or on demand. Triggers on "pr self review", "self review", "review my changes before PR", "pre-PR check", "ready to open a PR", "/pr-self-review".
version: 1.0.0
disable-model-invocation: true
---

# PR Self Review (v1.0.0)

Reviews what is about to go into a pull request, using the skills already in `.claude/skills/`. It routes and aggregates; the rules themselves live in those skills. **Read-only — never edit the code under review.**

## Hard rules

- **Any CRITICAL finding → verdict `BLOCKED`.** Tell the user not to open the PR, and not to merge these changes, until the findings are fixed and this skill passes again. Do not offer or run `gh pr create` while BLOCKED.
- Never report `PASS` unless every review task finished. A failed/skipped task → `INCOMPLETE`.
- UI skills never see backend files and backend skills never see UI files; the routing in `references/routing.json` is the only authority. Do not hand a subagent more files than its task lists.
- Report only. No automatic fixes.

## Steps

### 1. Collect and route the diff

```bash
node .claude/skills/pr-self-review/scripts/collect-diff.mjs [--base <ref>]
```

Prints JSON: `files`, `tasks` (one per skill, chunked), `excluded`, `deleted`, `unrouted`, `warnings`, `unroutedSkills`, `skillsWithoutFiles`, `headSha`, `mergeBase`, `fingerprint`, `dirty`, `onRemote`, `empty`.

- `empty: true` → say there is nothing to review and stop (no result file, no status).
- The script exits 2 on a fatal error (no git repo, no base ref): show the stderr message, verdict `INCOMPLETE`.
- Show `warnings` (vendored/migration edits) in the report; they are not findings.
- If `unroutedSkills` is non-empty, say so: a skill exists with no routing rule in `references/routing.json`.

### 2. Run the review tasks in parallel

Launch one **read-only subagent per entry in `tasks`**, all in a single message (`general-purpose`). Prompt template:

> You are reviewing a subset of a local diff against ONE skill. Do not edit, write or create any file, and do not run anything that changes the repo.
> 1. Read `.claude/skills/{skill}/SKILL.md` and the reference files it points to that are relevant to the files below (for `onion-architecture` and `react-frontend-structure` also `references/review-checklist.md`; read the package's `AGENTS.md` for conventions).
> 2. For each file: `git diff {mergeBase} -- <file>` shows the change (untracked files: read the whole file, everything is new). Read enough surrounding code to judge it.
> 3. Review ONLY these files: {files}. Apply ONLY that skill's rules. Ignore anything the skill does not cover.
> 4. Levels: use the skill's own severity tag if it has one, else follow `.claude/skills/pr-self-review/references/severity.md`. Mark a finding CRITICAL only if it passes the CRITICAL gate in that file (introduced by this diff, concrete evidence, real consequence). Flag violations that already existed and were not introduced by the diff as `preExisting: true`, max HIGH.
> 5. Return ONLY a JSON array (empty `[]` if clean), each item: `{"skill","severity":"CRITICAL|HIGH|MEDIUM|LOW","file","line","rule","why","evidence","fix","preExisting":false}`. `evidence` is the exact offending code, quoted. No prose outside the JSON.

### 3. Aggregate and verify

- Merge all arrays. If one `file:line` is reported by several skills, keep one finding at the highest severity and list every skill.
- **Verify every CRITICAL yourself**: open the file at the reported line and check it against the CRITICAL gate in `references/severity.md`. Downgrade to HIGH (and say why) if the evidence does not match the code, the line was not touched by the diff, or the consequence is not real. This step is what keeps a false positive from blocking a PR.
- A task whose subagent failed, returned non-JSON, or did not return → `INCOMPLETE`, and name the task.

### 4. Verdict

| Condition | Verdict |
|---|---|
| ≥1 CRITICAL after verification | `BLOCKED` |
| a task failed/was skipped, or the collect step failed | `INCOMPLETE` |
| otherwise | `PASS` (HIGH/MEDIUM/LOW are reported, not blocking) |

BLOCKED outranks INCOMPLETE.

### 5. Record the result

Write `.claude/pr-self-review/last-result.json` (git-ignored). The PreToolUse guard (`scripts/pre-pr-guard.mjs`) reads it:

```json
{
  "verdict": "BLOCKED",
  "criticalCount": 1,
  "counts": { "CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 0 },
  "headSha": "<from collect-diff>",
  "mergeBase": "<from collect-diff>",
  "fingerprint": "<from collect-diff>",
  "timestamp": "<ISO 8601>"
}
```

### 6. Publish the GitHub status

```bash
node .claude/skills/pr-self-review/scripts/publish-status.mjs
```

Prints `{published, reason?}`. It sets commit status `pr-self-review` (`success` / `failure` / `error`) on HEAD, only if the working tree is clean, HEAD is pushed, and `gh` is installed and authenticated. If not published, show the `reason` and what to do (commit, push, install `gh`) — this is not a failure of the review. The status **does not block merging by itself**; the repo owner can later require the check in a ruleset.

### 7. Report

Use `references/report-template.md`. Verdict first.

- `BLOCKED`: list the CRITICAL findings first, then say the changes must not be merged until fixed; after fixes, re-run this skill.
- `PASS`: say it is clear to open the PR (commit and push first if `publish-status` asked for it).
- `INCOMPLETE`: say what did not run and how to re-run.

## When it runs

- Manually: `/pr-self-review`.
- Before a PR: the hook in `.claude/settings.json` runs `scripts/pre-pr-guard.mjs` on every `gh pr create` Claude issues and refuses it unless the last result is `PASS` for the current code. If Claude is about to open a PR and there is no fresh PASS, run this skill first.
- The guard only covers PRs opened through Claude; it does not stop a PR opened in the browser.

## Maintaining routing

Add a skill → add a rule to `references/routing.json` (`skill`, `group` = `ui` | `backend` | `cross-cutting`, `include`/`exclude` globs, optional `contentPattern`). `collect-diff.mjs` lists skills missing from routing in `unroutedSkills`. Skills that are not reviewers (docs, diagrams) go into `ignoreSkills`.
