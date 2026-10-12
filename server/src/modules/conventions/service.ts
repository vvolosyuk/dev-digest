import type { FeatureModelChoice, LLMProvider, RepoRef, Skill, SkillType } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, ConfigError, ExternalServiceError, NotFoundError } from '../../platform/errors.js';
import { renderPrompt } from '../../platform/prompts.js';
import { wrapUntrusted } from '../../platform/prompt.js';
import { toSkillDto } from '../_shared/skill-dto.js';
import {
  CHEAP_MODEL_CHAIN,
  CONFIG_FILES,
  DRAFT_PROMPT_FILE,
  DRAFT_SCHEMA_NAME,
  DRAFT_TEMPERATURE,
  DRAFT_TIMEOUT_MS,
  EXTRACTION_SCHEMA_NAME,
  EXTRACTION_TEMPERATURE,
  EXTRACTION_TIMEOUT_MS,
  MAX_CANDIDATES,
  PG_UNIQUE_VIOLATION,
  SAMPLE_TOP_FILES,
  SYSTEM_PROMPT_FILE,
} from './constants.js';
import {
  assembleSkillBody,
  ConventionExtraction,
  ConventionSkillDraft,
  evidenceAreas,
  evidenceRef,
  groundCandidates,
  isSafeRepoPath,
  isUniqueViolation,
  normalizeDescription,
  numberLines,
  templateDraft,
  toConventionDto,
  type ConventionDto,
} from './helpers.js';
import {
  ConventionsRepository,
  type ConventionPatch,
  type ConventionRepoBasics,
  type ConventionRow,
} from './repository.js';

/**
 * L02 — Conventions extractor.
 *
 *   sample (code only) → one cheap structured LLM call → ground every candidate
 *   against the real files (code only) → persist survivors as `pending`.
 *
 * The user then accepts/rejects/edits candidates and merges the accepted ones
 * into a single `extracted` skill. Linking that skill to agents is manual.
 */

export interface ConventionsList {
  candidates: ConventionDto[];
  last_scan_at: string | null;
}

export interface ExtractResult extends ConventionsList {
  sampled_files: number;
  discarded: number;
  duplicates: number;
  model: string;
}

export interface CreateConventionsSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  convention_ids: string[];
  /** What to do when the name is taken (default `fail` → 409). */
  on_conflict?: 'fail' | 'new_version';
}

export interface SkillDraftResult {
  description: string;
  body: string;
  /** `template` when the LLM was unavailable or failed (see `warning`). */
  generated_by: 'llm' | 'template';
  model?: string;
  warning?: string;
}

/** Repo exists but extraction can't run (not cloned / not indexed) → 409. */
export class ConventionsUnavailableError extends AppError {
  constructor(message: string, reason: string) {
    super('conventions_unavailable', message, 409, { reason });
  }
}

export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionsList> {
    await this.requireRepo(workspaceId, repoId);
    return this.snapshot(workspaceId, repoId);
  }

  async extract(workspaceId: string, repoId: string): Promise<ExtractResult> {
    const repo = await this.requireRepo(workspaceId, repoId);
    if (!repo.clonePath) {
      throw new ConventionsUnavailableError('Repository is not cloned yet', 'not_cloned');
    }

    const files = await this.sample(repo);
    if (files.sources.length === 0) {
      throw new ConventionsUnavailableError(
        'No ranked source files — wait for repo indexing to finish (or enable repo-intel) and retry',
        'no_samples',
      );
    }

    const { llm, model } = await this.pickModel(workspaceId);
    const system = await renderPrompt(SYSTEM_PROMPT_FILE, { max: String(MAX_CANDIDATES) });
    const user = [...files.configs, ...files.sources]
      .map((p) => wrapUntrusted(p, numberLines(files.contents.get(p)!)))
      .join('\n\n');

    let raw: ConventionExtraction;
    try {
      const res = await llm.completeStructured({
        model,
        schema: ConventionExtraction,
        schemaName: EXTRACTION_SCHEMA_NAME,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Repository: ${repo.owner}/${repo.name}\n\n${user}` },
        ],
        temperature: EXTRACTION_TEMPERATURE,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      });
      raw = res.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new ExternalServiceError(
        `Convention extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Evidence may only point at SOURCE samples — configs inform style but
    // aren't code a reviewer can cite.
    const citable = new Map(files.sources.map((p) => [p, files.contents.get(p)!]));
    const { verified, discarded } = groundCandidates(raw.candidates, citable);
    const { duplicates } = await this.repo.replacePending(workspaceId, repoId, verified);

    return {
      ...(await this.snapshot(workspaceId, repoId)),
      sampled_files: files.configs.length + files.sources.length,
      discarded,
      duplicates,
      model,
    };
  }

  async update(
    workspaceId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionDto | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toConventionDto(row) : undefined;
  }

  /**
   * Save the (user-edited) merged skill. Every id must be an ACCEPTED candidate
   * of this repo; their evidence paths become the skill's `evidence_files`.
   *
   * Name already taken:
   *   - `on_conflict: 'fail'` (default) → 409 with `{ name, skill_id, version }`
   *     so the client can ask whether to save a new version instead;
   *   - `on_conflict: 'new_version'` → the existing skill gets this content as
   *     version N+1 (snapshot noted), keeping its source and agent links.
   */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionsSkillInput,
  ): Promise<{ skill: Skill; created: boolean }> {
    await this.requireRepo(workspaceId, repoId);
    const rows = await this.requireAccepted(workspaceId, repoId, input.convention_ids);
    const evidenceFiles = [...new Set(rows.map((r) => r.evidencePath).filter((p): p is string => !!p))];
    const content = {
      description: input.description,
      type: input.type,
      body: input.body,
      enabled: input.enabled,
      evidenceFiles,
    };

    const existing = await this.container.skillsRepo.getByName(workspaceId, input.name);
    if (existing) {
      if (input.on_conflict !== 'new_version') throw this.nameConflict(existing.skill);
      const row = await this.container.skillsRepo.update(workspaceId, existing.skill.id, content, {
        bumpVersion: true,
        note: `Regenerated from ${rows.length} accepted conventions`,
      });
      if (!row) throw new NotFoundError('Skill not found');
      return { skill: toSkillDto(row, existing.agentCount), created: false };
    }

    try {
      const row = await this.container.skillsRepo.insert({
        workspaceId,
        name: input.name,
        source: 'extracted',
        ...content,
      });
      return { skill: toSkillDto(row, 0), created: true };
    } catch (err) {
      // Lost a race with a concurrent create of the same name.
      if (isUniqueViolation(err, PG_UNIQUE_VIOLATION)) {
        const raced = await this.container.skillsRepo.getByName(workspaceId, input.name);
        if (raced) throw this.nameConflict(raced.skill);
      }
      throw err;
    }
  }

  private nameConflict(skill: { id: string; name: string; version: number }): AppError {
    return new AppError('conflict', `A skill named "${skill.name}" already exists`, 409, {
      name: skill.name,
      skill_id: skill.id,
      version: skill.version,
    });
  }

  /**
   * Draft the merged skill's description + body. The model writes the prose
   * ("Flag … Use when …" description, when-to-use, rule wording,
   * exceptions, severity); evidence is inserted from the verified rows. Any
   * LLM failure degrades to the deterministic template — never a 5xx.
   */
  async draftSkill(
    workspaceId: string,
    repoId: string,
    conventionIds: string[],
    skillName: string,
  ): Promise<SkillDraftResult> {
    const repo = await this.requireRepo(workspaceId, repoId);
    const rows = await this.requireAccepted(workspaceId, repoId, conventionIds);
    const fallback = templateDraft(repo.name, rows);

    let draft: ConventionSkillDraft;
    let model: string;
    try {
      const picked = await this.pickModel(workspaceId);
      model = picked.model;
      const system = await renderPrompt(DRAFT_PROMPT_FILE, {});
      const input = rows
        .map((c) =>
          wrapUntrusted(
            `convention ${c.id}`,
            `id: ${c.id}\ncategory: ${c.category}\nrule: ${c.rule}\nevidence: ${evidenceRef(c)}\n\n${c.evidenceSnippet ?? ''}`,
          ),
        )
        .join('\n\n');
      const res = await picked.llm.completeStructured({
        model,
        schema: ConventionSkillDraft,
        schemaName: DRAFT_SCHEMA_NAME,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Repository: ${repo.owner}/${repo.name}\n` +
              `Evidence areas: ${evidenceAreas(rows).join(', ')}\n\n${input}`,
          },
        ],
        temperature: DRAFT_TEMPERATURE,
        timeoutMs: DRAFT_TIMEOUT_MS,
      });
      draft = res.data;
    } catch (err) {
      return {
        description: fallback.description,
        body: assembleSkillBody(skillName, fallback, rows),
        generated_by: 'template',
        warning: err instanceof Error ? err.message : String(err),
      };
    }

    return {
      description: normalizeDescription(draft.description) ?? fallback.description,
      body: assembleSkillBody(skillName, draft, rows),
      generated_by: 'llm',
      model,
    };
  }

  // ---- internals ----

  /** Rows for `ids` in the given order; 422 unless every one is an ACCEPTED candidate of this repo. */
  private async requireAccepted(workspaceId: string, repoId: string, ids: string[]): Promise<ConventionRow[]> {
    const unique = [...new Set(ids)];
    const rows = await this.repo.listByIds(workspaceId, repoId, unique);
    if (rows.length !== unique.length || rows.some((r) => r.status !== 'accepted')) {
      throw new AppError(
        'validation_error',
        'Only accepted conventions of this repository can be merged into a skill',
        422,
      );
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    return unique.map((id) => byId.get(id)!);
  }

  private async requireRepo(workspaceId: string, repoId: string): Promise<ConventionRepoBasics> {
    const repo = await this.repo.getRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repository not found');
    return repo;
  }

  private async snapshot(workspaceId: string, repoId: string): Promise<ConventionsList> {
    const [rows, last] = await Promise.all([
      this.repo.listByRepo(workspaceId, repoId),
      this.repo.lastScanAt(workspaceId, repoId),
    ]);
    return { candidates: rows.map(toConventionDto), last_scan_at: last?.toISOString() ?? null };
  }

  /**
   * Code-only sampling: known config files (when present) + the top-ranked
   * source files from repo-intel. Unreadable files are skipped.
   */
  private async sample(repo: ConventionRepoBasics): Promise<{
    configs: string[];
    sources: string[];
    contents: Map<string, string>;
  }> {
    const ref: RepoRef = { owner: repo.owner, name: repo.name };
    const contents = new Map<string, string>();
    const read = async (path: string): Promise<boolean> => {
      if (!isSafeRepoPath(path) || contents.has(path)) return false;
      try {
        const text = await this.container.git.readFile(ref, path);
        if (!text.trim()) return false;
        contents.set(path, text);
        return true;
      } catch {
        return false;
      }
    };

    const configs: string[] = [];
    for (const p of CONFIG_FILES) if (await read(p)) configs.push(p);

    const ranked = await this.container.repoIntel.getConventionSamples(repo.id, SAMPLE_TOP_FILES);
    const sources: string[] = [];
    for (const p of ranked) if (await read(p)) sources.push(p);

    return { configs, sources, contents };
  }

  /**
   * Workspace override for the `conventions` feature, else the first cheap
   * model whose provider has a key configured.
   */
  private async pickModel(workspaceId: string): Promise<{ llm: LLMProvider; model: string }> {
    const override = await this.repo.featureModelOverride(workspaceId);
    const chain: FeatureModelChoice[] = override ? [override] : CHEAP_MODEL_CHAIN;
    for (const choice of chain) {
      try {
        return { llm: await this.container.llm(choice.provider), model: choice.model };
      } catch (err) {
        if (!(err instanceof ConfigError) || override) throw err;
      }
    }
    throw new ConfigError('No LLM provider key configured — add one in Settings');
  }
}
