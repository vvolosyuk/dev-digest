# Skills — client (L02)

Status: implemented.

See [`server/specs/skills.md`](../../server/specs/skills.md) for the backend
half (data model, `/skills` API, import parsing, agent links, run injection,
shared-contract changes). The original design draft is `skills_spec.md` at the
repo root.

## Context

The server now stores skills (reusable markdown instructions), versions them,
links them to agents in order, and injects active ones into review prompts with
per-slot token counts in the trace. This half adds the UI: a Skills page
(list + detail with Config / Preview / Versions), import from `.md` / `.zip`,
a Skills tab in the agent editor, `+N tokens` in the run trace, and a nav entry.

## Decisions

1. **Six skill tabs, three working**: Config / Preview / Versions work;
   Context / Evals / Stats are disabled stubs ("Coming in L05 / L06 / L07").
   "Run on evals" is disabled (L06). Cards show a real `N agents`; no
   pull/accept metrics.
2. **No new dependencies**: body editor = `Textarea mono` + line-number gutter
   + `~N tokens` (`ceil(chars/4)`, marked approximate — the exact count is in
   the trace via tiktoken); reorder = native HTML5 DnD + ↑/↓ buttons for
   keyboard access (no dnd-kit); version diff = small client-side LCS line diff.
3. **Preview = prompt**: `skills/helpers.ts → formatSkillBlock` mirrors the
   server's `modules/_shared/skill-prompt.ts` — keep both in sync.
4. **Import is two-step and explicit**: preview first (nothing persisted),
   save only on an explicit click (`source: imported_url`). Imported skills
   that were never edited (`source === "imported_url" && version === 1`) show a
   **needs vetting** badge.
5. **Saving an edit goes through `SaveVersionModal`** (not in the draft): the
   user titles the new version (stored as the version `note`) and sees a diff
   of saved → unsaved before confirming. Cancel saves nothing and keeps edits.
6. **Navigation override is local**: `vendor/ui/nav.ts` is untouched;
   `components/app-shell` patches in a **SKILLS LAB** group (Skills → `/skills`,
   icon `Sparkles`, `g s`; Agents moves into it).
7. Reads all new contract fields as `.nullish()` — traces recorded before L02
   (no `tokens`) render without token counts.

## Frontend changes

- **Routes**: `src/app/skills/page.tsx` and `src/app/skills/[id]/page.tsx` →
  `SkillsView` (selected skill from the route, tab from `?tab=`).
- **`src/app/skills/_components/`**:
  - `SkillsView` (+ `hooks.ts`) — two-pane layout, unsaved-edits guard when
    switching skills, empty / select-prompt states.
  - `SkillList`, `SkillCard` — type icon, mono name, enabled `Toggle`
    (stopPropagation), 1-line description, `SkillTypeBadge`
    (rubric / convention / security / custom), source label, `N agents`,
    needs-vetting badge; disabled skills are dimmed. **Add Skill ▾** dropdown:
    Create skill / Import from file….
  - `SkillDetail` — header (icon, name, type badge, `vN`, disabled
    "Run on evals", Delete) + tabs: `ConfigTab`, `PreviewTab`, `VersionsTab`,
    `StubTab`, `TabHeader`.
  - `SkillBodyEditor` — `<name>.md` header, `unsaved` badge, `~N tokens`, gutter.
  - `SaveVersionModal`, `VersionDiffModal` (version vs current, Restore after
    confirm), shared `SkillDiff` (meta-field rows + LCS line diff).
  - `ImportSkillModal` (+ `ImportPreview`) — file input (`.md,.zip`) →
    `FileReader` → base64 → preview with `untrustedNotice` banner, editable
    name / description / type, rendered body, `ignored_files` with reasons,
    warnings, conflict error on name until renamed.
  - `DeleteSkillModal` — lists agents using the skill (`/skills/:id/agents`).
- **Agent editor**: `AgentEditor/_components/SkillsTab` (+ `SkillRow`);
  `skills` added to `TABS` / `VALID_TABS`. Lists all workspace skills — linked
  first in link order, then unlinked by name; `{linked} of {total} enabled`
  badge, filter, order hint; globally disabled skill → "disabled globally"
  badge + disabled checkbox. Check/uncheck/↑↓/drag send the full ordered set
  via `PUT /agents/:id/skills` with an optimistic update. Empty workspace →
  `EmptyState` linking to `/skills`.
- **Agents list**: `AgentsListView` passes `skillCount={agent.skill_count}`.
- **Run trace**: `PromptBlock` takes `tokens` / `additive`; `TraceBody` shows
  `+N tokens` on the Skills block and `N tokens` on other slots from
  `assembly.tokens`; nothing when absent.
- **Hooks** `src/lib/hooks/skills.ts` (exported via `hooks/index.ts`):
  `useSkills(q)`, `useSkill`, `useCreateSkill`, `useUpdateSkill`,
  `useDeleteSkill`, `useSkillVersions`, `useSkillVersion`,
  `useRestoreSkillVersion`, `useImportSkillPreview`, `useAgentSkills`,
  `useSetAgentSkills` (optimistic). Invalidates `["skills"]`, `["skill", id]`,
  `["skill-versions", id]`, `["agent-skills", agentId]`, `["agent", id]`,
  `["agents"]` as relevant.
- **Nav**: `components/app-shell/{AppShell.tsx,constants.ts,helpers.ts}` —
  SKILLS LAB group, `g s` shortcut, `/skills` active key.
- **i18n**: `messages/en/skills.json` (new `detail`, `tabs`, `stub`, `config`,
  `editor`, `previewTab`, `versions`, `diff`, `import`, `delete`,
  `saveVersion`; `listItem` gains needs-vetting), `agents.json` (editor Skills
  tab), `runs.json` (`trace.prompt.tokens` / `tokensAdded`).
- `globals.css` — `color-scheme` per `data-theme` + themed `select option`, so
  the Type dropdown's native option list is readable in dark mode.

## Out of scope

- Context / Evals / Stats tab content (L05 / L06 / L07), "Run on evals".
- Pull / accept metrics on skill cards.
- Exact token count in the editor (estimate only; exact count is in the trace).

## Testing strategy (client)

Vitest + RTL, hooks mocked with `vi.mock`:

- `SkillCard.test.tsx` — renders fields; toggle doesn't open the card;
  needs-vetting badge.
- `ConfigTab.test.tsx` — Save disabled until dirty, unsaved badge + token
  estimate, validation errors block save, Save → version dialog → mutate with
  title, cancelling the dialog keeps edits, Cancel discards, create mode makes a
  `manual` skill.
- `VersionsTab.test.tsx` — note or `—`, Current badge, diff, restore only after
  confirm.
- `ImportSkillModal.test.tsx` — base64 upload + ignored files shown, save only
  on explicit click as `imported_url`, Cancel creates nothing, conflict until
  renamed.
- `SkillsView.test.tsx` — empty state, disabled Run on evals, unsaved guard on
  switch, `?tab=` switching.
- `SkillsTab.test.tsx` — linked-first ordering + counter + toggle, ↑/↓ payload,
  globally disabled checkbox + filter, empty state.
- `TraceBody.test.tsx` — `+N tokens` on skills, `N tokens` elsewhere, none for
  legacy traces.
- Pure helpers: `skills/helpers.test.ts` (`formatSkillBlock`, `needsVetting`,
  form validation), `SkillDiff/helpers.test.ts` (LCS), `SkillBodyEditor/helpers.test.ts`,
  `ImportSkillModal/helpers.test.ts` (base64), `app-shell/helpers.test.ts`
  (SKILLS LAB patch, `/skills` key).

## E2E coverage

None. No `e2e/specs/*.flow.json` covers skills; the seed creates no skills, so
a flow would first need seeded skill rows (or to create one through the UI).
Manual verification steps are in `skills_spec.md` → Verification and
`docs/skills-samples/experiments.md`.
