# Conventions extractor — server (L02)

Status: implemented.

Frontend half: [`client/specs/conventions.md`](../../client/specs/conventions.md).

## Context

The second half of L02 ("Skills in the product · Conventions extractor"). Scan a
cloned repo, have a cheap model propose house conventions with file+line
evidence, verify that evidence **in code**, let the user accept / reject / edit
candidates, and merge the accepted ones into one `extracted` skill.

## Flow

`POST /repos/:id/conventions/extract`

1. **Sample (code only, no model).** Config files from a fixed list
   (`CONFIG_FILES`: tsconfig, eslint, prettier, editorconfig) + the top-12
   ranked source files from `repoIntel.getConventionSamples()`. Missing files are
   skipped. No ranked files (repo-intel disabled / not indexed) → 409
   `conventions_unavailable`; repo not cloned → 409.
2. **One structured LLM call** (`schemaName: 'ConventionExtraction'`). Each file
   goes in line-numbered (`  23| code`), truncated to 300 lines / 12k chars, and
   wrapped by `wrapUntrusted`. The system prompt is
   `src/prompts/conventions.system.md`. Output: `{ category, rule, evidence:
   { path, line_start, line_end, snippet }, confidence }[]`.
3. **Model choice.** The workspace's `feature_models.conventions` override wins.
   Otherwise a dynamic cheap default is used: the first provider with a
   configured key out of `openai/gpt-5.4-mini` → `anthropic/claude-3-5-haiku-latest`
   → `openrouter/deepseek/deepseek-v4-flash`. This is why `FEATURE_MODELS`'
   static default for `conventions` isn't used here.
4. **Grounding** (`helpers.ts`, pure). A candidate is dropped unless:
   - its path is safe: relative, no `..`. This is the traversal guard, because
     `GitClient.readFile` joins paths blindly.
   - its path is one of the sampled **source** files. Configs can't be cited.
   - its snippet occurs in the file as consecutive non-blank lines, compared
     whitespace-insensitively. `NN| ` prefixes are stripped.

   Line numbers are only a hint and are corrected to the nearest real
   occurrence. The stored snippet is taken **from the file**. Empty rules and
   in-batch duplicates are also dropped. The rest is sorted by confidence and
   capped at 20.
5. **Persist** (one transaction). Delete this repo's `pending` rows, skip new
   rules whose normalized text matches an `accepted`/`rejected` row, then
   insert. **Re-scan keeps decisions.**

Response: `{ candidates, last_scan_at, sampled_files, discarded, duplicates, model }`.

## Other routes

- `GET /repos/:id/conventions` → `{ candidates, last_scan_at }`.
- `PATCH /conventions/:id` `{ status?, rule?, category? }`. At least one field is
  required (empty body → 422). Category is kebab-cased. `accepted` mirrors
  `status === 'accepted'`. Evidence is not editable.
- `POST /repos/:id/conventions/skill-draft` `{ convention_ids, name }` →
  `{ description, body, generated_by: 'llm' | 'template', model?, warning? }`.
  The ids must be accepted candidates of this repo (else 422).
  - **Format:** matches `docs/skills-samples/*.md`, with no frontmatter. The
    version lives in Skills Lab. The body has these sections: `# <skill name>`
    (from `name`, never written by the model; the client keeps it in sync when
    the name is edited),
    summary, `## When to use`, `## Rules` (`### n. heading`, rule, **Flag when**,
    `Example (path:lines)` with a fenced snippet), `## Not a violation`,
    `## Severity`, `## Finding format`.
  - **Prose:** the model (`pickModel`, `schemaName: 'ConventionSkillDraft'`,
    prompt `src/prompts/conventions-skill.system.md`) writes the
    description ("Flag … Use when …" with concrete areas, 10–300 chars),
    summary, when-to-use, the rule wording per id, exceptions and severity.
  - **Evidence:** the code inserts it from the DB rows (`assembleSkillBody`).
    Rule ids the model skipped fall back to the stored rule; ids it invented
    are ignored. Prose is flattened to one line, so the model can't inject
    sections.
  - **Fallback:** any LLM failure returns `templateDraft()`. The description
    is built from the categories and the evidence directories and file types,
    and `warning` carries the error. The route never returns a 5xx for this.
- `POST /repos/:id/conventions/skill` `{ name, description, type, enabled, body,
  convention_ids }` → 201 `Skill`.
  - Every id must be an **accepted** candidate of this repo (else 422).
  - Creates the skill via `container.skillsRepo.insert` with `source: 'extracted'`
    and `evidence_files` = the unique evidence paths.
  - Name already taken, with the default `on_conflict: 'fail'` → 409. The error
    details are `{ name, skill_id, version }`.
  - `on_conflict: 'new_version'` (the user confirmed) → 200. The existing skill
    gets the new description, type, body, enabled flag and `evidence_files` as
    version N+1. The snapshot note is "Regenerated from N accepted
    conventions". The skill keeps its `source` and agent links.
  - The skill is **not** linked to any agent; linking is done manually in the
    agent editor.

## Schema

Migration `0012`: `conventions` gets `category`, `evidence_line_start`,
`evidence_line_end`, `status` (`pending|accepted|rejected`), `created_at`, and an
index on `(repo_id, status)`. The legacy `accepted` boolean is kept in sync for
the vendored `ConventionCandidate` contract. The richer DTO (`ConventionDto`) is
typed locally in the module, so `vendor/shared` is untouched.

## Layering notes

- Modules don't import each other. `toSkillDto` moved to
  `modules/_shared/skill-dto.ts` (`skills/helpers.ts` re-exports it), and the
  conventions repository reads `settings` / `repos` itself.
- Skill limits are mirrored in `conventions/constants.ts`.

## Tests

- `test/conventions-evidence.test.ts` (unit): path guard, snippet matching,
  line correction, grounding/dedupe.
- `test/conventions-skill-draft.test.ts` (unit): body sections/order,
  evidence from rows, skipped/invented ids, description normalization,
  template draft.
- `test/conventions.it.test.ts` (Postgres): extract discards ungrounded
  candidates, untrusted wrapping, re-scan keeps decisions, PATCH, merge →
  `extracted` skill, skill-draft (LLM + template fallback), 409/422/404.
