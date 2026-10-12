# Report template

Print exactly this structure (omit a section only where noted). Findings are sorted CRITICAL → LOW.

````markdown
# PR Self Review — {BLOCKED | PASS | INCOMPLETE}

`{branch}` vs `{base}` @ `{headSha[0:7]}` · {counts.changed} files changed · {counts.reviewed} reviewed
{one line: "❌ N CRITICAL finding(s) — do not open/merge this PR until fixed." | "✅ No CRITICAL findings." | "⚠️ Review incomplete: {reason}."}

## Skills run
| Skill | Group | Files | Findings (C/H/M/L) |
|---|---|---|---|
| onion-architecture | backend | 19 | 1 / 2 / 0 / 0 |

Not run: {skill — "no matching files in diff"}, …

## Findings
### CRITICAL
- **{file}:{line}** — `{skill}` · {rule}
  {why}
  ```
  {evidence}
  ```
  Fix: {suggested fix}

### HIGH / MEDIUM / LOW
(same shape; MEDIUM/LOW may be one line each)

## Warnings (not reviewed)
- {path} — {reason}                       ← vendored / migrations edits, large files

## Not covered
- Unrouted files: {n} (docs/config) — {first few}
- Skills without a routing rule: {unroutedSkills}   ← omit if none

## GitHub status
{published `pr-self-review` = failure|success on {sha[0:7]} | not published: {reason and what to do}}
````

Rules:
- Verdict line first, so the answer is visible without scrolling.
- Never print PASS if any review task failed or was skipped — that is INCOMPLETE.
- Report facts only; no fixes are applied by this skill.
