import type { Container } from '../../platform/container.js';
import type {
  Skill,
  SkillImportPreview,
  SkillSource,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';
import { PG_UNIQUE_VIOLATION } from './constants.js';
import {
  buildImportPreview,
  isSkillConfigChange,
  isUniqueViolation,
  toSkillDto,
  toSkillVersionDto,
} from './helpers.js';
import type { SkillsRepository } from './repository.js';

/**
 * L02 — skills service. CRUD + config versioning (`skill_versions` snapshots)
 * + import preview. Every read/write is workspace-scoped; `undefined` results
 * are mapped to 404 by the routes.
 */

/** A skill with this name already exists in the workspace → 409. */
export class SkillNameConflictError extends AppError {
  constructor(name: string) {
    super('conflict', `A skill named "${name}" already exists`, 409, { name });
  }
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: SkillSource;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
  note?: string;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(container: Container) {
    this.repo = container.skillsRepo;
  }

  async list(workspaceId: string, q?: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId, q?.trim() || undefined);
    return rows.map((r) => toSkillDto(r.skill, r.agentCount));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row.skill, row.agentCount) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.withConflict(input.name, () =>
      this.repo.insert({
        workspaceId,
        name: input.name,
        description: input.description,
        type: input.type,
        body: input.body,
        source: input.source ?? 'manual',
        enabled: input.enabled,
      }),
    );
    return toSkillDto(row, 0);
  }

  /**
   * Patch a skill. A change to name/description/type/body bumps the version
   * and snapshots it (with the optional `note`); toggling `enabled` alone does not.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;
    const { note, ...fields } = patch;
    const bumpVersion = isSkillConfigChange(existing.skill, fields);
    const row = await this.withConflict(fields.name ?? existing.skill.name, () =>
      this.repo.update(workspaceId, id, fields, { bumpVersion, note }),
    );
    return row ? toSkillDto(row, existing.agentCount) : undefined;
  }

  /** Delete a skill; returns how many agents were unlinked (undefined → 404). */
  async delete(workspaceId: string, id: string): Promise<number | undefined> {
    return this.repo.deleteById(workspaceId, id);
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;
    const rows = await this.repo.listVersions(id);
    return rows.map((r) => toSkillVersionDto(r, existing.skill));
  }

  async getVersion(
    workspaceId: string,
    id: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;
    const row = await this.repo.getVersion(id, version);
    return row ? toSkillVersionDto(row, existing.skill) : undefined;
  }

  /**
   * Restore version `v` by writing its content as a NEW version (history is
   * never rewritten). Undefined when the skill or version doesn't exist.
   */
  async restoreVersion(
    workspaceId: string,
    id: string,
    version: number,
  ): Promise<Skill | undefined> {
    const target = await this.getVersion(workspaceId, id, version);
    if (!target) return undefined;
    const existing = (await this.repo.getById(workspaceId, id))!;
    const row = await this.withConflict(target.name, () =>
      this.repo.update(
        workspaceId,
        id,
        { name: target.name, description: target.description, type: target.type, body: target.body },
        { bumpVersion: true, note: `Restored from v${version}` },
      ),
    );
    return row ? toSkillDto(row, existing.agentCount) : undefined;
  }

  /** Agents linking a skill (for the delete confirmation). */
  async agents(
    workspaceId: string,
    id: string,
  ): Promise<{ id: string; name: string }[] | undefined> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;
    return this.repo.agentsForSkill(id);
  }

  /** Parse an uploaded `.md`/`.zip` into a preview. Persists nothing. */
  async importPreview(
    workspaceId: string,
    filename: string,
    bytes: Uint8Array,
  ): Promise<SkillImportPreview> {
    const preview = buildImportPreview(filename, bytes);
    const conflict = preview.name ? await this.repo.existsByName(workspaceId, preview.name) : false;
    return { ...preview, conflict };
  }

  /** Map a unique-index violation on (workspace_id, name) to a 409. */
  private async withConflict<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err, PG_UNIQUE_VIOLATION)) throw new SkillNameConflictError(name);
      throw err;
    }
  }
}
