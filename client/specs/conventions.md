# Conventions extractor — client (L02)

Status: implemented.

Server half and the extraction/grounding pipeline: [`server/specs/conventions.md`](../../server/specs/conventions.md).

## Route

`/repos/:repoId/conventions` is in the **SKILLS LAB** nav group (Skills → Agents
→ Conventions), with the `g c` shortcut. The nav entry is added by
`withSkillsLab()` in `components/app-shell/helpers.ts`; `vendor/ui/nav.ts` is
untouched. `page.tsx` is thin: it resolves the repo's `full_name` and renders
`ConventionsView`.

## Components

- **`ConventionsView`**
  - Header ("Conventions in `<repo>`", last scan time) and a Re-scan button.
  - Empty state with a "Run extraction" CTA. After a scan, a result line shows
    the counts: sampled files, model, new candidates, discarded (no verifiable
    evidence), already decided.
  - Toolbar: Accept all / Deselect all, "X of Y accepted", and Create skill
    (disabled when nothing is accepted).
- **`ConventionCard`**
  - Shows the rule, a category badge, and `path:start-end` with a numbered,
    copyable snippet.
  - Confidence bar colours: ≥0.8 ok, ≥0.6 warn, otherwise crit.
  - Accept/Reject toggles; clicking the active one resets the card to
    `pending`. Rejected cards are dimmed and sorted last.
  - Inline edit covers the rule and category only.
- **`CreateConventionsSkillModal`**
  - On open it loads `POST …/skill-draft` through a query; Regenerate refetches it and
    asks for confirmation if you've edited the draft.
  - While drafting, Description and Body show skeletons and Create is
    disabled. The draft fills the description ("Flag … Use when …") and the
    body (samples format, evidence inserted by the server).
  - A note shows which model wrote the draft. A warning banner appears when
    the server fell back to the template.
  - Name defaults to `<repo>-conventions`, type to `convention`. Everything
    is editable. It reuses `SkillBodyEditor`, `SKILL_TYPES` and
    `validateSkillForm` from `/skills`.
  - If the name is taken (409), the footer asks "already exists (vN) — Save as
    vN+1 / Discard". Save re-posts with `on_conflict: 'new_version'`; Discard
    closes the modal without saving. Renaming away from the taken name
    dismisses the question.
  - On success it navigates to `/skills/:id`. The skill is not linked to
    agents.

## Data

`lib/hooks/conventions.ts`:

- `useConventions` uses the query key `["conventions", repoId]`.
- `useExtractConventions` writes its result straight into the cache.
- `useUpdateConvention` is optimistic, with rollback.
- `useConventionsSkillDraft` is a query (`gcTime: 0`, `staleTime: Infinity`, no retries or auto-refetch). It is loaded on open, and Regenerate calls `refetch()`.
- `useCreateSkillFromConventions` invalidates `["skills"]`.

The `Convention` type is local, because the vendored `ConventionCandidate`
lacks category, line range and status.

## Tests

- `conventions/helpers.test.ts`
- `ConventionCard.test.tsx`
- `CreateConventionsSkillModal.test.tsx`
- `app-shell/helpers.test.ts`: the nav group and the `g c` shortcut
