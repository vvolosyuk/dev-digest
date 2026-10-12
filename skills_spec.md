# L02 — Skills у продукті: специфікація

Status: implemented (гілка `L02`). Фактичний стан і відхилення від цього
драфту — у `server/specs/skills.md` та `client/specs/skills.md`.

## Context

Агенти DevDigest зараз мають лише власний `system_prompt`. Треба дати змогу
виносити повторно використовувані інструкції («скіли» — чистий markdown-текст,
нічого не виконують) в окремі сутності: створювати / редагувати / версіонувати /
імпортувати в UI, прив'язувати до кількох агентів у заданому порядку й бачити в
трасі прогону, що саме і скільки токенів скіли додали до промпта. Плюс два нові
агенти (Test Quality, API Contract) і контрольний експеримент «без скілів vs зі
скілами».

### Що вже є (перевикористовуємо, не дублюємо)

| Шар | Що готове | Де |
|---|---|---|
| БД | `skills` (name, description, type, source, body, enabled, version, evidence_files), `skill_versions(skill_id, version, body)`, `agent_skills(agent_id, skill_id, order)` — створені в `0000_init.sql` | `server/src/db/schema/skills.ts`, `schema/agents.ts` |
| Контракти | `Skill`, `SkillType`, `SkillSource`, `AgentSkillLink`, `AgentVersionConfig.skills` | `vendor/shared/contracts/knowledge.ts` |
| Агент→скіли API | `GET/POST /agents/:id/skills`, repo `linkedSkills/setSkills/linkSkill/unlinkSkill` | `server/src/modules/agents/*` |
| Рушій | `ReviewInput.skills?: string[]` → `assemblePrompt` кладе `## Skills / rules` у user-повідомлення, `PromptAssembly.skills` у трасу | `reviewer-core/src/review/run.ts`, `prompt.ts` |
| Траса UI | `PromptBlock` для `skills` уже рендериться | `client/.../RunTraceDrawer/_components/TraceBody/TraceBody.tsx` |
| i18n | `messages/en/skills.json` (page, drawer, file, listItem, preview.untrustedNotice…), `agents.json → skills.{title, enabledCount, orderHint}` | `client/messages/en/` |
| UI kit | Tabs, Dropdown, Modal, Drawer, Toggle, Checkbox, Textarea mono, Markdown, Badge, EmptyState | `client/src/vendor/ui` |
| Токенізатор | `container.tokenizer` (tiktoken / approx) | `server/src/adapters/tokenizer` |

### Чого бракує (gap)
- модуля `server/src/modules/skills` (CRUD, версії, імпорт);
- `run-executor` не передає `skills` у `reviewPullRequest` (`run-executor.ts:191`), fail-path хардкодить `skills: null` (`:429`);
- per-agent `enabled` у `agent_skills`; версіонування агента при зміні скілів;
- пер-секційних токенів у трасі (є лише total);
- клієнтської сторінки `/skills`, вкладки Skills в редакторі агента, пункту навігації;
- upload/zip (немає ні multipart, ні zip-бібліотеки);
- агентів Test Quality / API Contract; `disable-model-invocation` у `pr-self-review`.

## Прийняті рішення (з відповідей користувача + дефолти)

1. **UI-обсяг:** усі 6 вкладок скіла; **Config / Preview / Versions — робочі**,
   **Context / Evals / Stats — disabled-заглушки** з підписом «Coming in L05 / L06 / L07».
   Кнопка «Run on evals» — disabled з tooltip «L06». На картці — реальне
   `N agents`; `pull` / `accept` не показуємо (метрик ще немає).
2. **Прив'язка:** нова колонка `agent_skills.enabled boolean not null default true`.
   У промпт іде скіл, якщо `link.enabled && skill.enabled`. Вимкнений лінк
   зберігає позицію в порядку.
3. **Дані:** агенти Test Quality Reviewer і API Contract Reviewer — у `seed.ts`;
   скіли — **вручну через UI** (тексти-заготовки в `docs/skills-samples/`), один —
   через імпорт `.zip`.
4. **Імпорт:** `.md` (frontmatter `name`, `description`, опц. `type`) або `.zip`, з
   якого береться **лише `SKILL.md`** (корінь або рівно одна тека вглиб).
   Усе інше (`scripts/`, `references/`, бінарники) не читається й показується в
   прев'ю як «ignored».
5. **Source для імпорту:** використовуємо наявне `imported_url` (UI-лейбл «Imported»),
   щоб не міняти enum. `manual` — створене в UI.
6. **Довіра:** скіли лишаються *trusted* інструкціями (не `<untrusted>`), бо інакше
   вони перестануть працювати як правила. Захист — на вході: прев'ю + явне
   підтвердження + банер `preview.untrustedNotice` + бейдж «needs vetting» на
   імпортованих, доки користувач не відредагує/не підтвердить. (Тему «чужий скіл =
   чужі інструкції» проговорюємо на відео.)
7. **Навігація:** `vendor/ui/nav.ts` не чіпаємо — локальний override у
   `client/src/components/app-shell/AppShell.tsx`: нова група **SKILLS LAB** →
   Skills (`/skills`, icon `Sparkles`, `gKey: "s"`), Agents переноситься в цю групу.
8. **Редактор тіла:** без нових залежностей — `Textarea mono` + gutter з номерами
   рядків + лічильник `~N tokens` (`ceil(chars/4)`, позначено як приблизне;
   точне значення — у трасі через tiktoken).
9. **Drag-reorder:** нативний HTML5 DnD (`draggable`, `onDragOver`, `onDrop`) +
   клавіатурні кнопки ↑/↓ для доступності. Без dnd-kit.
10. **Diff версій:** клієнтський line-diff (невеликий LCS-хелпер у `helpers.ts`),
    рендер у Modal.

---

## Server

### Модель даних (міграція через `pnpm db:generate`, ніколи вручну)
- `agent_skills.enabled boolean not null default true`.
- `skills`: унікальний індекс `(workspace_id, name)` — name є «ідентифікатором»
  скіла (kebab-case).
- `skill_versions`: + `name text`, `description text`, `type text`, `note text null`
  — снепшот усієї конфігурації, не лише body (для Restore і «Tightened scope
  rule…» у списку версій). Існуючі колонки не змінюються.
- `skills.updated_at` (для «synced»/сортування) — `now()`-pattern з `_shared`.

### Контракти (`vendor/shared`, редагуються ідентично в `server/` і `client/`, як у run-cost)
- `Skill`: + `agent_count: z.number().int().nullish()`, `updated_at: z.string().nullish()`.
- `SkillVersion { skill_id, version, name, description, type, body, note?, created_at }`.
- `AgentSkillLink`: + `enabled: z.boolean().default(true)`.
- `PromptAssembly`: + `tokens: z.record(z.string(), z.number().int()).nullish()` —
  токени по слотах (`system`, `skills`, `memory`, `repo_map`, `callers`, `pr_description`, `user`).
- `SkillImportPreview { name, description, type, body, warnings: string[], ignored_files: {path, reason}[], conflict: boolean }`.
- `Agent` list DTO: + `skill_count: z.number().int().nullish()` (активні лінки, для `AgentCard.skillCount`).
- Усе нове — `.nullish()`, щоб старі `run_traces` JSONB і фікстури тестів парсились.

### Валідація (Zod у routes, schema-first)
- `name`: `^[a-z0-9][a-z0-9-]{1,62}$`.
- `description`: 10–300 символів. Це **інтерфейс скіла**, формулюється директивно
  («Flag …», «Use when …») — підказка лише в UI, сервер не перевіряє стиль.
- `type`: `SkillType`; `body`: 1–20 000 символів.

### Модуль `server/src/modules/skills/` (onion: routes → service → repository)
`routes.ts`, `service.ts`, `repository.ts`, `helpers.ts` (`toSkillDto`, `parseSkillMarkdown`,
`extractSkillFromZip`), `constants.ts` (ліміти). Реєстрація — `modules/index.ts`.
Repo-getter `skillsRepo` у `platform/container.ts` (потрібен `run-executor`).

| Метод | Шлях | Поведінка |
|---|---|---|
| GET | `/skills` | список воркспейсу + `agent_count`; `?q=` пошук по name/description |
| GET | `/skills/:id` | один скіл |
| POST | `/skills` | створити (`version=1`, снепшот v1), `source` = `manual` або `imported_url` |
| PUT | `/skills/:id` | patch; якщо змінились name/description/type/body → `version+1` + снепшот (з `note`); зміна лише `enabled` не версіонується (як у агентів, `isConfigChange`) |
| DELETE | `/skills/:id` | cascade лінків; відповідь 200 з кількістю відв'язаних агентів |
| GET | `/skills/:id/versions` | список, нові зверху |
| GET | `/skills/:id/versions/:v` | один снепшот (для Diff) |
| POST | `/skills/:id/versions/:v/restore` | створює **нову** версію з вмістом v (історія не переписується) |
| GET | `/skills/:id/agents` | агенти, що використовують скіл (для delete-confirm) |
| POST | `/skills/import/preview` | **нічого не зберігає**; повертає `SkillImportPreview` |

409 на дубль імені (`ConflictError`), 404 через `NotFoundError`, як в agents.

### Імпорт (`POST /skills/import/preview`)
- Тіло: `{ filename, content_base64 }` (JSON; route `bodyLimit` 2 MB). Без multipart.
- Розпізнавання по розширенню + magic bytes (`PK\x03\x04` для zip).
- `.md`: парс frontmatter (`name`, `description`, `type?`); без frontmatter → name з
  імені файлу (kebab), description порожній → warning.
- `.zip`: нова залежність **`fflate`** (pure JS, in-memory). Ліміти: стиснутий ≤ 1 MB,
  розпакований `SKILL.md` ≤ 100 KB, ≤ 200 entries; читаємо **тільки** `SKILL.md`
  (фільтр у `unzip` — інші entries не розпаковуються взагалі), нічого не пишемо на
  диск, нічого не виконуємо. Решта файлів → `ignored_files` з reason
  `executable` (`.sh .py .js .ts .mjs .exe .bat .ps1`, біт виконання) / `not-skill-core`.
  Вкладені zip, symlink-entries — ignored. Нема `SKILL.md` → 422.
- `conflict: true`, якщо ім'я вже зайняте (клієнт дає перейменувати).
- Збереження — звичайним `POST /skills` після підтвердження в UI.

### Прив'язка до агента (зміни в `modules/agents`)
- Новий `PUT /agents/:id/skills` body `{ links: [{ skill_id, enabled }] }` — повний
  впорядкований набір (order = index). Існуючий `POST` лишається сумісним
  (`skill_ids` → усі `enabled: true`).
- `GET /agents/:id/skills` повертає `AgentSkillLink[]` з `enabled`.
- Зміна набору/порядку/enabled скілів → `version+1` агента + `snapshotVersion`
  (зараз `setSkills` цього не робить — закриваємо gap). У снепшоті `skills` —
  лише **enabled** id в порядку.
- `GET /agents` додає `skill_count`.

### Інʼєкція в прогін (`modules/reviews/run-executor.ts`)
1. Перед `reviewPullRequest`: `skillsRepo.activeForAgent(agentId)` — join
   `agent_skills ⋈ skills where link.enabled and skill.enabled order by order`.
2. Кожен скіл форматується на сервері (`helpers.formatSkillBlock`):
   ```
   ### Skill: <name> (<type>, v<version>)
   <description>

   <body>
   ```
   і передається як `skills: string[]` (reviewer-core не змінюється — він уже
   склеює через `\n\n` у `## Skills / rules`).
3. Лог: `runLog.event('skills', 'Loaded N skills: a, b (+T tokens)', { skills: [{id, name, version, tokens}] })`;
   нуль скілів → `'No skills enabled'`. Вимкнений скіл у лозі не з'являється.
4. Після outcome: `assembly.tokens` = `container.tokenizer.count` по кожному
   ненульовому слоту `PromptAssembly` (у trace-builder).
5. Fail-path `traceFromBuffer` (`:429`): передавати зібраний skills-блок замість `null`.
6. Map-reduce: скіли автоматично йдуть у кожен chunk (вже так у `run.ts`).

### Seed (`seed.ts` + `seed-prompts.ts` + `docs/agent-prompts/*.md`)
- **Test Quality Reviewer** — шукає непокриті гілки, пропущені corner cases,
  надмірне мокування, флейки. Промпт навмисно базовий (без чек-листів — вони у скілах).
- **API Contract Reviewer** — зміни публічних контрактів (роути, схеми, DTO).
- Обидва: `openrouter / deepseek/deepseek-v4-flash`, як решта; idempotent by name.
  Скілів seed не створює.

### Тести (server)
- `test/skills.it.test.ts` — CRUD, 409 на дубль, versioning (body bump / enabled no-bump), restore → нова версія.
- `test/skills-import.test.ts` — md з/без frontmatter, zip з `SKILL.md` + `scripts/run.sh` (ignored, не розпакований), zip без `SKILL.md` → 422, oversize → 413/422, вкладений zip.
- `test/agents-skills.it.test.ts` — `PUT` links, порядок, enabled, version bump агента.
- `test/run-executor-skills.test.ts` — порядок блоків у `assembly.skills`, вимкнений (link або global) відсутній, `tokens.skills` > 0, лог-подія.
- `test/contracts.test.ts` — старі фікстури без нових полів парсяться.

---

## Client

### Маршрути та файли (конвенції `client/AGENTS.md`)
- `src/app/skills/page.tsx` → `SkillsView`; `src/app/skills/[id]/page.tsx` → `SkillsView` з вибраним (як `AgentEditorShell`). Вкладка в `?tab=`.
- `src/app/skills/_components/`: `SkillsView`, `SkillList`, `SkillCard`, `SkillDetail`
  (`_components/ConfigTab`, `PreviewTab`, `VersionsTab`, `StubTab`), `SkillBodyEditor`,
  `ImportSkillModal`, `DeleteSkillModal`, `VersionDiffModal`.
- `src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/`.
- `src/lib/hooks/skills.ts`: `useSkills(q)`, `useSkill`, `useCreateSkill`, `useUpdateSkill`,
  `useDeleteSkill`, `useSkillVersions`, `useSkillVersion`, `useRestoreSkillVersion`,
  `useImportSkillPreview`, `useAgentSkills`, `useSetAgentSkills`; експорт через `hooks/index.ts`.
  Інвалідація: `["skills"]`, `["skill", id]`, `["agent-skills", agentId]`, `["agents"]`.

### Сторінка Skills (дизайн 1–5)
- Ліва колонка: заголовок, **Add Skill ▾** (`Dropdown`: «Create skill», «Import from file…»),
  пошук, список `SkillCard`: іконка за типом, name (mono), `Toggle` enabled
  (stopPropagation, як `AgentCard`), description (1 рядок, ellipsis), бейдж типу
  (rubric=accent, convention=green, security=red, custom=muted), source-мітка
  (Manual / Imported / Extracted / Community), `N agents`. Вимкнений — приглушений.
- Права частина: header (іконка, name, type badge, `vN`), «Run on evals» disabled.
  Порожній стан — `EmptyState` (`skills.page.empty`).
- **Config:** Name*, Description (helper: «Describe when the agent should apply this skill — write it as an instruction, e.g. "Flag …"»), Type (`SelectInput`), Enabled toggle, Skill body* (`SkillBodyEditor`: шапка `<name>.md` + бейдж `unsaved` + `~N tokens`, gutter номерів рядків), Change note (опц.), Save / Cancel. Unsaved-guard при перемиканні скіла.
- **Preview:** «Rendered as the reviewing agent receives it» — `Markdown` від тіла
  у тому ж форматі, що `formatSkillBlock` (дзеркальний хелпер, щоб preview = промпт).
- **Versions:** список (vN, note або «—», дата, бейдж Current), `Diff` → `VersionDiffModal`
  (поточна vs вибрана, line-diff), `Restore` → confirm → `POST …/restore`.
- **Context / Evals / Stats:** `StubTab` з `EmptyState` «Coming in L05/L06/L07», вкладки disabled-стилем.

### Імпорт (`ImportSkillModal`)
1. Крок 1: file input (`.md,.zip`), читання `FileReader` → base64 → `useImportSkillPreview`.
2. Крок 2 (прев'ю): банер `untrustedNotice` («Imported skills are someone else's instructions that will run inside your agent's prompt. Review before saving.»), редаговані name/description/type, rendered body, список `ignored_files` з причиною (`executable — not run`), warnings, conflict → поле name з помилкою.
3. «Save skill» тільки явною дією → `POST /skills` (`source: imported_url`). Скасування — нічого не зберігається.

### Вкладка Skills в редакторі агента (дизайн 6)
- `TABS` + `VALID_TABS` += `skills`; `AgentEditor` перемикає по `tab`.
- Заголовок «Skills» + бейдж `{linked} of {total} enabled`, фільтр, hint `orderHint`.
- Список **всіх** скілів воркспейсу: спершу прив'язані в порядку `order`, далі
  неприв'язані (за назвою). Рядок: drag-handle, `Checkbox`, name, type-badge;
  глобально вимкнений скіл — бейдж «disabled globally», checkbox недоступний.
- Чекбокс: неприв'язаний → link (в кінець прив'язаних, enabled); прив'язаний → toggle `enabled`.
- Drag / ↑↓ змінює порядок → оптимістичне оновлення + `PUT /agents/:id/skills`.
- `AgentsListView` передає `skillCount={agent.skill_count}`.

### Траса прогону
- `PromptBlock` для `skills` показує в шапці `+N tokens` з `assembly.tokens.skills`
  (і відповідні числа для інших блоків); відсутні `tokens` → нічого не показуємо.

### Навігація
- `AppShell` override NAV: група **SKILLS LAB** (Skills, Agents). `helpers.activeKeyFor` уже знає `/skills`.

### Тести (client, vitest + RTL, `vi.mock` на hooks)
- `SkillCard.test.tsx` (toggle не відкриває картку), `ConfigTab.test.tsx` (валідація, unsaved, save → mutate), `ImportSkillModal.test.tsx` (preview → ignored files показані, save лише після кліку, cancel не викликає create), `SkillsTab.test.tsx` (лічильник, check/uncheck, reorder ↑↓ → правильний payload), `VersionsTab.test.tsx`, `TraceBody.test.tsx` (+N tokens).

---

## Супутні артефакти

### `docs/skills-samples/` (тексти для ручного створення / імпорту)
- Test Quality: `untested-branches.md` (rubric), `corner-cases-checklist.md` (rubric),
  `over-mocking.md` (convention), **`flaky-tests/` → `flaky-tests.zip`** (`SKILL.md` +
  `scripts/detect.sh` — демонструє, що виконуване ігнорується) — імпорт.
- API Contract: `route-signature-compat.md` (rubric), `breaking-change-detector.md` (security/custom).
- Кожен з директивним `description`.

### Контрольний експеримент (`docs/skills-samples/experiments.md`)
- **Test Quality:** PR додає функцію з гілкою (`if (amount <= 0) throw`) + тест лише
  на happy-path. Прогін без скілів (вимкнути лінки) → очікувано пропуск; зі
  скілами → finding про непокриту гілку та межовий випадок (`0`, від'ємне).
- **API Contract:** PR змінює сигнатуру роуту (перейменований/обов'язковий параметр,
  змінений shape відповіді). Без скілів → пропуск; зі скілами → breaking change.
- Для кожного: відкрити трасу → Prompt assembly → блок `Skills / rules` з `+N tokens`;
  у прогоні без скілів блоку немає. Тексти diff-ів для тестового репо — в документі.

### `pr-self-review`
- Додати `disable-model-invocation: true` у frontmatter `.claude/skills/pr-self-review/SKILL.md`
  (зараз відсутнє). Перевірити `references/routing.json`: client-файли →
  react/next skills, server/reviewer-core → onion/fastify/drizzle/zod. Ручний виклик
  `/pr-self-review` на гілці L02 має показати обидві групи.

## Порядок реалізації (для подальшої роботи)
1. Міграція + контракти (обидві копії `vendor/shared`).
2. Модуль skills (CRUD, versions) + тести.
3. agents: `PUT /skills`, enabled, version bump, `skill_count`.
4. run-executor: інʼєкція, лог, `assembly.tokens`.
5. Імпорт (`fflate`) + тести.
6. Seed двох агентів + промпти.
7. Client: hooks → Skills page → Agent Skills tab → Import → Trace tokens → nav.
8. `pr-self-review` frontmatter; зразки скілів; експеримент.

## Verification (наприкінці реалізації)
- `cd server && pnpm db:generate && pnpm db:migrate`; `npx vitest run` у server, `npm test` у reviewer-core, `pnpm test` + `pnpm typecheck` у client.
- `./scripts/dev.sh` → створити скіл у UI, відредагувати (v2 у Versions, Diff, Restore).
- Імпортувати `flaky-tests.zip` → у прев'ю `scripts/detect.sh` позначений «ignored», нічого не виконувалось; зберегти після підтвердження.
- Прив'язати скіли до обох нових агентів; вимкнути один → прогін: у лозі `Loaded N skills` без нього, у трасі блок `Skills / rules` + `+N tokens`.
- Контрольний експеримент на обох агентах (без/зі скілами) за `experiments.md`.
- `/pr-self-review` вручну → обидві групи скілів (frontend + backend) у звіті; PASS.
