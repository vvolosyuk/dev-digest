# Skill samples

Ready-made skill texts for the two L02 agents seeded by `server/src/db/seed.ts`
(**Test Quality Reviewer** and **API Contract Reviewer**). The seed deliberately
creates **no skills**: you add these yourself, by hand in the UI or by importing a
file, then link them to the agents. Both agent prompts are intentionally basic
(see [`../agent-prompts/`](../agent-prompts/README.md)); the checklists below are what
make the difference — compare the two in [`experiments.md`](./experiments.md).

A skill is plain markdown text. It never executes anything: at run time the bodies
of the agent's enabled, linked skills are concatenated (in link order) into the
`## Skills / rules` block of the prompt.

## Files

| File | Skill `name` | `type` | Link to agent | How to add |
|---|---|---|---|---|
| [`untested-branches.md`](./untested-branches.md) | `untested-branches` | rubric | Test Quality Reviewer | manual or import `.md` |
| [`corner-cases-checklist.md`](./corner-cases-checklist.md) | `corner-cases-checklist` | rubric | Test Quality Reviewer | manual or import `.md` |
| [`over-mocking.md`](./over-mocking.md) | `over-mocking` | convention | Test Quality Reviewer | manual or import `.md` |
| [`flaky-tests/`](./flaky-tests/SKILL.md) → [`flaky-tests.zip`](./flaky-tests.zip) | `flaky-tests` | rubric | Test Quality Reviewer | **import `.zip`** |
| [`route-signature-compat.md`](./route-signature-compat.md) | `route-signature-compat` | rubric | API Contract Reviewer | manual or import `.md` |
| [`breaking-change-detector.md`](./breaking-change-detector.md) | `breaking-change-detector` | custom | API Contract Reviewer | manual or import `.md` |
| [`experiments.md`](./experiments.md) | — | — | both | control experiment: without vs with skills |

Every file starts with frontmatter:

```yaml
---
name: kebab-case-name            # 2–63 chars, [a-z0-9-]
description: Flag … / Use when … # 10–300 chars, directive: tells the agent WHEN to apply it
type: rubric                     # rubric | convention | security | custom (default: custom)
---
```

## Option A — create manually

1. Open **Skills** (`/skills`) → **New skill**.
2. Copy `name`, `description` and `type` from the file's frontmatter into the form.
3. Paste everything **below** the closing `---` into the body editor. Save — this is v1.
4. Repeat for each file you want.

## Option B — import a `.md`

1. **Skills** → **Import** → choose one of the `.md` files above.
2. The preview shows the parsed name / description / type, the body, and any
   warnings. Review the text — an imported skill is an instruction to your agent.
3. Confirm to save. Imported skills are labelled **Imported** and show a
   "needs vetting" badge until you edit or confirm them.

## Option C — import the zip (`flaky-tests.zip`)

The zip contains:

```
flaky-tests/SKILL.md          ← the only file that is read
flaky-tests/scripts/detect.sh ← executable helper, shown as "ignored", never run
```

1. **Skills** → **Import** → choose `flaky-tests.zip`.
2. The preview lists `scripts/detect.sh` as **ignored (executable)**: DevDigest reads
   only `SKILL.md` (at the zip root or exactly one folder deep) and never executes or
   stores anything else. That is the point of this sample.
3. Confirm to save.

To rebuild the zip after editing `flaky-tests/`, from this folder:

```sh
zip -r flaky-tests.zip flaky-tests/SKILL.md flaky-tests/scripts/detect.sh
```

(no `zip` on Windows? `python -c "import zipfile;z=zipfile.ZipFile('flaky-tests.zip','w',zipfile.ZIP_DEFLATED);[z.write(p) for p in ('flaky-tests/SKILL.md','flaky-tests/scripts/detect.sh')]"`).

## Link the skills to the agents

1. **Agents** → open **Test Quality Reviewer** → **Skills** tab.
2. Check `untested-branches`, `corner-cases-checklist`, `over-mocking`, `flaky-tests`;
   order them with ↑/↓ (or drag) — most important first. Save (bumps the agent version).
3. Same for **API Contract Reviewer** with `route-signature-compat` and
   `breaking-change-detector`.
4. A link can be switched off without unlinking — it keeps its position but is not
   injected. That is how the "without skills" run in `experiments.md` is done.
