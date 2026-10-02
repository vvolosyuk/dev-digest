# Review checklist (skill v1.0.0)

Run from `client/src` (Git Bash / POSIX `grep`). Each command should print nothing for a clean tree, except where a known violation is listed below.

```bash
# A: no imports into another route's tree (missed promotion)
grep -rnE "from ['\"]@/app/" app components lib
# A: shared layers never import from app/
grep -rnE "from ['\"](@/app|(\.\./)+app/)" lib components
# A: deep relative chains out of the subtree — use @/ instead (tests excluded; known baseline, see below)
grep -rnE "from ['\"](\.\./){3,}(lib|components|vendor)/" app components --include=*.tsx --include=*.ts | grep -v "\.test\."
# B: component folders missing index.ts
for d in $(find app components -type d -path "*_components/*" ! -name _components); do [ -f "$d/index.ts" ] || echo "$d"; done
# E: helpers/constants must stay pure (no react, no hooks)
grep -rnE "from ['\"]react['\"]|\buse[A-Z][A-Za-z]*\(" --include=helpers.ts --include=constants.ts app components lib
# F: no direct fetch / TanStack Query plumbing outside lib/hooks
grep -rnE "(^|[^A-Za-z.])fetch\(|\buse(Query|Mutation|InfiniteQuery|QueryClient)\(|queryKey:" app components | grep -v "\.test\."
# F: no api.ts calls outside lib/hooks (ApiError import is allowed)
grep -rnE "from ['\"]@/lib/api['\"]" app components | grep -v "ApiError }"
# G: route segments contain only Next.js files, _components/, constants/helpers/styles and tests
find app -maxdepth 6 -type f ! -path "*/_components/*" | grep -vE "/(page|layout|loading|error|not-found|route|constants|helpers|styles)\.tsx?$|\.test\.tsx?$|\.css$"
```

## Known pre-existing violations (as of v1.0.0 — don't widen, fix when touching)

- `app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx:12` imports `formatUsd` from `[number]/_components/RunTraceDrawer/helpers` — rule A. Promote `formatUsd` to `src/lib/` (e.g. `lib/format.ts`) and import it from both.
- `app/repos/[repoId]/pulls/[number]/page.tsx` — `useQueryClient` + raw `queryKey` invalidations (`pr-active-runs`, `pr-runs`, `pulls`) in the page — rules F and G. Move the invalidation into the `useCancelRun`/run-status hooks in `lib/hooks/reviews.ts`.
- `app/repos/[repoId]/pulls/[number]/_components/RunHistory/` has no `index.ts`; `FindingsTab` imports `../RunHistory/RunHistory` — rule B.
- 27 non-test files (55 import lines) under `app/**` reach `lib/`/`components/` via `../../../…` chains instead of `@/` (e.g. `AgentEditor/_components/ConfigTab/ConfigTab.tsx`) — rule A, LOW. Switch to `@/` when touching the file.
- `src/components/` mixes kebab-case (`app-shell`, `diff-viewer`) and PascalCase (`FindingsHoverPopover`, `SeverityCountBadges`) folder names. New shared components use PascalCase per `client/AGENTS.md`; don't rename existing ones in an unrelated diff.

Report format: `file:line — rule A–G — suggested move/fix`.
