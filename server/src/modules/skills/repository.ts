import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
import type { SkillSource, SkillType } from '@devdigest/shared';
import { INITIAL_SKILL_VERSION } from './constants.js';
import { escapeLike } from './helpers.js';
export type { SkillRow, SkillVersionRow };

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled?: boolean;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** A skill row plus the number of agents linking it. */
export interface SkillWithAgentCount {
  skill: SkillRow;
  agentCount: number;
}

/** `(select count(*) from agent_skills where skill_id = skills.id)` */
const agentCountSql = sql<number>`(select count(*)::int from ${t.agentSkills} where ${t.agentSkills.skillId} = ${t.skills.id})`;

/**
 * L02 — skills data-access. Owns `skills` and `skill_versions`; reads the
 * `agent_skills` link table (the agents repository owns writes to it).
 * Workspace-scoped throughout.
 */
export class SkillsRepository {
  constructor(private db: Db) {}

  /**
   * Skills that go into an agent's prompt: linked AND link-enabled AND
   * globally enabled, in link `order`. Used by the review run-executor.
   */
  async activeForAgent(agentId: string): Promise<SkillRow[]> {
    const rows = await this.db
      .select({ skill: t.skills })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => r.skill);
  }

  /** Workspace skills (sorted by name) with agent counts; `q` matches name/description. */
  async list(workspaceId: string, q?: string): Promise<SkillWithAgentCount[]> {
    const pattern = q ? `%${escapeLike(q)}%` : undefined;
    const rows = await this.db
      .select({ skill: t.skills, agentCount: agentCountSql })
      .from(t.skills)
      .where(
        and(
          eq(t.skills.workspaceId, workspaceId),
          pattern
            ? or(ilike(t.skills.name, pattern), ilike(t.skills.description, pattern))
            : undefined,
        ),
      )
      .orderBy(asc(t.skills.name));
    return rows.map((r) => ({ skill: r.skill, agentCount: Number(r.agentCount) }));
  }

  async getById(workspaceId: string, id: string): Promise<SkillWithAgentCount | undefined> {
    const [row] = await this.db
      .select({ skill: t.skills, agentCount: agentCountSql })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row ? { skill: row.skill, agentCount: Number(row.agentCount) } : undefined;
  }

  async existsByName(workspaceId: string, name: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, name)));
    return row !== undefined;
  }

  /** Insert a skill AND its v1 snapshot, atomically. */
  async insert(values: InsertSkill): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description,
          type: values.type,
          source: values.source,
          body: values.body,
          enabled: values.enabled ?? true,
          version: INITIAL_SKILL_VERSION,
        })
        .returning();
      await tx.insert(t.skillVersions).values(snapshotOf(row!, null));
      return row!;
    });
  }

  /**
   * Patch a skill. When `bumpVersion` is set the version is incremented and the
   * new config snapshotted (with `note`) in the same transaction. `updated_at`
   * always moves.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
    opts: { bumpVersion: boolean; note?: string | null },
  ): Promise<SkillRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(t.skills)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(opts.bumpVersion ? { version: sql`${t.skills.version} + 1` } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();
      if (row && opts.bumpVersion) {
        await tx.insert(t.skillVersions).values(snapshotOf(row, opts.note ?? null));
      }
      return row;
    });
  }

  /** Delete a skill (links + versions cascade). Returns the number of unlinked agents, or undefined if absent. */
  async deleteById(workspaceId: string, id: string): Promise<number | undefined> {
    return this.db.transaction(async (tx) => {
      const [links] = await tx
        .select({ n: count() })
        .from(t.agentSkills)
        .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
      const deleted = await tx
        .delete(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning({ id: t.skills.id });
      return deleted.length > 0 ? Number(links?.n ?? 0) : undefined;
    });
  }

  /** Version snapshots for a skill, newest first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }

  /** Agents (id + name) linking a skill, by name. */
  async agentsForSkill(skillId: string): Promise<{ id: string; name: string }[]> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(eq(t.agentSkills.skillId, skillId))
      .orderBy(asc(t.agents.name));
  }
}

function snapshotOf(row: SkillRow, note: string | null): typeof t.skillVersions.$inferInsert {
  return {
    skillId: row.id,
    version: row.version,
    name: row.name,
    description: row.description,
    type: row.type,
    body: row.body,
    note,
  };
}
