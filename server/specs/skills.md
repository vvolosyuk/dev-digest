# Skills — server (L02)

Status: implemented.

See [`client/specs/skills.md`](../../client/specs/skills.md) for the frontend
half of this feature (Skills page, agent Skills tab, import modal, trace token
display). The original design draft is `skills_spec.md` at the repo root; this
file records what was actually built, including where it deviates from that
draft.

## Context

Agents only had their own `system_prompt`. L02 lets reusable instructions
("skills" — plain markdown, nothing is executed) live as separate entities that
can be created / edited / versioned / imported, linked to several agents in a
given order, and observed in the run trace (what was injected and how many
tokens it cost). It also seeds two new agents (Test Quality, API Contract) used
for a "without skills vs with skills" control experiment.

The DB tables (`skills`, `skill_versions`, `agent_skills`), the `Skill` /
`AgentSkillLink` contracts and reviewer-core's `ReviewInput.skills` →
`## Skills / rules` assembly already existed; reviewer-core is **not changed**.

## Decisions

1. **Per-agent toggle**: `agent_skills.enabled`. A skill reaches the prompt only
   if `link.enabled && skill.enabled`. A disabled link keeps its position.
2. **Skill name is the identifier**: kebab-case, unique per workspace
   (`skills_workspace_name_uq`). Duplicate → 409 (`SkillNameConflictError`,
   mapped from Postgres `23505`).
3. **Versions snapshot the whole config** (name, description, type, body, note),
   not just the body, so Restore brings everything back. Restore creates a
   **new** version — history is never rewritten.
4. **Only config changes version a skill** (name/description/type/body);
   toggling `enabled` does not (mirrors agents' `isConfigChange`).
5. **Agent versioning on skill changes**: changing the *effective* (enabled,
   ordered) skill set bumps the agent `version` and snapshots `agent_versions`;
   the snapshot's `skills` holds only enabled ids in order. A no-op PUT (same
   effective set) does **not** bump.
6. **Skills stay trusted instructions** (not wrapped in `<untrusted>`) —
   protection is on input: import preview + explicit save in the UI.
7. **Import source** reuses the existing `imported_url` enum value (UI label
   "Imported") rather than adding a new one; UI-created skills are `manual`.
8. **Import never persists**: `POST /skills/import/preview` only parses;
   saving is a normal `POST /skills` after user confirmation.
9. **New contract fields are `.nullish()`** so old `run_traces` JSONB and
   existing test fixtures keep parsing (same rule as run-cost).

## Data model

Migration `0011_fuzzy_kingpin.sql` (generated via `pnpm db:generate`):

- `agent_skills.enabled boolean not null default true`.
- `skills.updated_at timestamptz not null default now()`.
- Unique index `skills_workspace_name_uq (workspace_id, name)`.
- `skill_versions` + `name`, `description`, `type`, `note` — all nullable so
  pre-L02 rows stay valid.

## Shared contracts (`vendor/shared`, edited identically in `server/` and `client/`)

- `knowledge.ts`:
  - `Skill` + `agent_count` (list endpoint only), `updated_at` — nullish.
  - New `SkillVersion { skill_id, version, name, description, type, body, note?, created_at }`.
  - New `SkillImportPreview { name, description, type, body, warnings[], ignored_files[{path, reason}], conflict }`.
  - `Agent` + `skill_count` (nullish; list endpoint only; counts links enabled
    AND skill enabled).
  - `AgentSkillLink` + `enabled` (`default(true)`).
- `trace.ts`: `PromptAssembly.tokens: record<string, int>` (nullish) — per-slot
  token counts.

## Module `server/src/modules/skills/` (onion: routes → service → repository)

`routes.ts`, `service.ts`, `repository.ts`, `helpers.ts` (`toSkillDto`,
`toSkillVersionDto`, `isSkillConfigChange`, `parseSkillMarkdown`,
`extractSkillFromZip`, `buildImportPreview`), `constants.ts` (validation +
import limits). Registered in `modules/index.ts`; `container.skillsRepo`
getter in `platform/container.ts` (used by the run-executor).

`formatSkillBlock` lives in `modules/_shared/skill-prompt.ts` (shared by the
skills module and the run-executor; the client mirrors it):

```
### Skill: <name> (<type>, v<version>)
<description>

<body>
```

| Method | Path | Behavior |
|---|---|---|
| GET | `/skills` | workspace list + `agent_count`; `?q=` searches name/description |
| GET | `/skills/:id` | one skill |
| POST | `/skills` | create (v1 + snapshot), 201; `source` `manual` (default) or `imported_url` |
| PUT | `/skills/:id` | patch; config change → `version+1` + snapshot with `note`; `enabled`-only → no bump |
| DELETE | `/skills/:id` | cascades links; `{ ok, unlinked_agents }` |
| GET | `/skills/:id/versions` | snapshots, newest first |
| GET | `/skills/:id/versions/:v` | one snapshot (for Diff) |
| POST | `/skills/:id/versions/:v/restore` | new version with v's content |
| GET | `/skills/:id/agents` | agents linking the skill (delete confirm) |
| POST | `/skills/import/preview` | parse `.md` / `.zip`, persists nothing |

### Validation (Zod in routes)

- `name`: `^[a-z0-9][a-z0-9-]{1,62}$`.
- `description`: trimmed, 10–300 chars (directive style is a UI hint only).
- `type`: `SkillType`; `body`: 1–20 000 chars; `note`: ≤ 500; `q`: ≤ 200.

### Import (`POST /skills/import/preview`)

- Body `{ filename, content_base64 }` (JSON, route `bodyLimit` 2 MB). No multipart.
- Detection by extension + zip magic bytes `PK\x03\x04`.
- `.md`: frontmatter `name`, `description`, `type?`. Content problems never
  throw — they become `warnings` (no frontmatter → name from filename, name
  normalized to kebab-case, empty/short description, unknown type → `custom`,
  empty/oversize body).
- `.zip` via **`fflate`** (new dependency, in-memory): compressed ≤ 1 MB,
  `SKILL.md` ≤ 100 KB, ≤ 200 entries. Only `SKILL.md` (root or exactly one
  folder deep) is decompressed; nothing is written to disk or executed. Other
  entries → `ignored_files` with reason `executable`
  (`.sh .py .js .ts .mjs .exe .bat .ps1`), `nested-archive`, or `not-skill-core`.
- Errors: size limits → **413** (`SkillImportTooLargeError`); empty file,
  unsupported type, invalid zip, no `SKILL.md`, several `SKILL.md`, non-UTF-8
  → **422** (`ValidationError`).
- `conflict: true` when the name is already taken in the workspace.

## Agent ↔ skill links (`modules/agents`)

- New `PUT /agents/:id/skills` body `{ links: [{ skill_id, enabled }] }` — full
  ordered set (order = index); duplicates → 422; unknown / foreign-workspace
  skill or unknown agent → 404. Empty array unlinks everything.
- Legacy `POST /agents/:id/skills` stays compatible (`skill_ids` → all enabled,
  now also rejects duplicates; `skill_id` → append).
- `GET /agents/:id/skills` returns links with `enabled`.
- `GET /agents` adds `skill_count`.
- Agent create/update and link changes now run in a transaction together with
  the `agent_versions` snapshot.

## Run injection (`modules/reviews/run-executor.ts`)

1. `loadSkillBlocks`: `skillsRepo.activeForAgent(agentId)` (link enabled AND
   skill enabled, in link order) → `formatSkillBlock` each → passed as
   `skills: string[]` to `reviewPullRequest` (omitted when empty, so the prompt
   keeps the no-skills shape). Map-reduce repeats them in every chunk.
2. Live Log: `Loaded N skills: a, b (+T tokens)` with payload
   `{ skills: [{ id, name, version, tokens }] }`, or `No skills enabled`.
   *Deviation from draft:* emitted as an `info` event — `RunEventKind` is a
   closed enum, so there is no `skills` kind.
3. `prompt_assembly.tokens` = `container.tokenizer.count` per non-empty slot
   (`helpers.slotTokens`; slots `system, skills, memory, specs, repo_map,
   callers, pr_description, user` — `specs` added vs the draft).
4. Fail path: `traceFromBuffer` records the joined skills block
   (`helpers.joinSkillBlocks`) instead of `null`, plus slot tokens.

## Seed

`seed.ts` + `seed-prompts.ts` (+ `docs/agent-prompts/test-quality-reviewer.md`,
`api-contract-reviewer.md`): **Test Quality Reviewer** and **API Contract
Reviewer** on `openrouter / deepseek/deepseek-v4-flash`, idempotent by name.
Prompts are intentionally basic — checklists live in skills. The seed creates
**no skills**; sample texts are in `docs/skills-samples/` (incl.
`flaky-tests.zip` with `scripts/detect.sh` to demonstrate ignored executables)
and the control experiment in `docs/skills-samples/experiments.md`.

## Out of scope

- Skill Context / Evals / Stats (L05 / L06 / L07) — no server endpoints.
- Community / URL import (`source: community`, `extracted`) — enum values exist,
  not produced by L02.
- Prompt-injection screening of skill bodies — handled by human review in the
  import preview only.

## Testing strategy (server)

- **server-unit**:
  - `skills-import.test.ts` — md with/without frontmatter, zip with `SKILL.md` +
    `scripts/run.sh` (ignored, not decompressed), zip without `SKILL.md` → 422,
    oversize → 413, nested zip.
  - `contracts.test.ts` — `Skill` without `agent_count`/`updated_at`,
    `AgentSkillLink` without `enabled` (→ `true`), `PromptAssembly` with and
    without `tokens`, `Agent` without `skill_count` all parse.
- **server-integration** (`*.it.test.ts`, needs Docker):
  - `skills.it.test.ts` — CRUD, 409 on duplicate name, versioning (body bump /
    enabled no-bump), restore → new version, `agent_count` / `?q=` /
    `/agents`, delete returns unlinked count, workspace isolation (404),
    legacy version rows fall back to the skill's fields, and the
    `/skills/import/preview` route (conflict flag, persists nothing, 422/413,
    2 MB `bodyLimit`).
  - `agents-skills.it.test.ts` — `PUT` links, order, enabled, agent version bump
    with enabled-only snapshot, no-op PUT doesn't bump, legacy POST, 422/404,
    `skill_count`.
  - `run-executor-skills.it.test.ts` — block order in `assembly.skills`,
    disabled (link or global) absent, `tokens.skills > 0`, log line, no-skills
    case, fail-path trace keeps the skills block.

For frontend test coverage, see `client/specs/skills.md`.
