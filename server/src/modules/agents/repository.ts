import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { CiFailOn, Provider, ReviewStrategy } from '@devdigest/shared';
import { DEFAULT_AGENT_DESCRIPTION, INITIAL_AGENT_VERSION } from './constants.js';
import { isConfigChange, sameIds } from './helpers.js';

/**
 * A2 — agents data-access. Owns `agents`, `agent_versions`, and the
 * `agent_skills` link table (shared with A1's skills repository, but A2 owns the
 * agent side: link/reorder/list for an agent). Workspace-scoped throughout.
 */

import type { AgentRow, AgentVersionRow } from '../../db/rows.js';
export type { AgentRow, AgentVersionRow };

export interface InsertAgent {
  workspaceId: string;
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
  createdBy?: string | null;
}

export interface UpdateAgent {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  systemPrompt?: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
}

/** A skill linked to an agent (with its order + per-agent toggle), joined from agent_skills. */
export interface LinkedSkillRow {
  skill: typeof t.skills.$inferSelect;
  order: number;
  enabled: boolean;
}

/** One entry of an agent's ordered skill set (order = array index). */
export interface SkillLinkInput {
  skillId: string;
  enabled: boolean;
}

/** A Drizzle transaction handle (same query surface as `Db`). */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything we can run a query on — the root client or an open transaction. */
type Executor = Db | Tx;

export class AgentsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<AgentRow[]> {
    return this.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
  }

  async listEnabled(workspaceId: string): Promise<AgentRow[]> {
    return this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.enabled, true)));
  }

  async getById(workspaceId: string, id: string): Promise<AgentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)));
    return row;
  }

  /** Delete an agent (scoped to workspace). Versions/skill-links cascade;
   *  agent_runs keep their history with agent_id set null. Returns false if
   *  no such agent existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
      .returning({ id: t.agents.id });
    return rows.length > 0;
  }

  /** Insert an agent AND record version 1 in agent_versions (immutable
   *  snapshot), atomically. */
  async insert(values: InsertAgent): Promise<AgentRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.agents)
        .values({
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description ?? DEFAULT_AGENT_DESCRIPTION,
          provider: values.provider,
          model: values.model,
          systemPrompt: values.systemPrompt,
          outputSchema: (values.outputSchema as object | undefined) ?? null,
          ...(values.strategy !== undefined ? { strategy: values.strategy } : {}),
          ...(values.ciFailOn !== undefined ? { ciFailOn: values.ciFailOn } : {}),
          ...(values.repoIntel !== undefined ? { repoIntel: values.repoIntel } : {}),
          enabled: values.enabled ?? true,
          version: INITIAL_AGENT_VERSION,
          createdBy: values.createdBy ?? null,
        })
        .returning();
      await this.snapshotVersion(tx, row!, INITIAL_AGENT_VERSION);
      return row!;
    });
  }

  /**
   * Update an agent. Any config change bumps the version and snapshots the new
   * config into agent_versions (reproducibility for eval) — in one transaction.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateAgent,
  ): Promise<AgentRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    // A config-affecting change (anything except just toggling enabled) bumps version.
    const configChanged = isConfigChange(existing, patch);
    const nextVersion = configChanged ? existing.version + 1 : existing.version;

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(t.agents)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
          ...(patch.model !== undefined ? { model: patch.model } : {}),
          ...(patch.systemPrompt !== undefined ? { systemPrompt: patch.systemPrompt } : {}),
          ...(patch.outputSchema !== undefined
            ? { outputSchema: patch.outputSchema as object }
            : {}),
          ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
          ...(patch.ciFailOn !== undefined ? { ciFailOn: patch.ciFailOn } : {}),
          ...(patch.repoIntel !== undefined ? { repoIntel: patch.repoIntel } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(configChanged ? { version: nextVersion } : {}),
        })
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
        .returning();

      if (configChanged && row) await this.snapshotVersion(tx, row, nextVersion);
      return row;
    });
  }

  private async snapshotVersion(tx: Tx, row: AgentRow, version: number): Promise<void> {
    const skills = await this.skillIdsForAgent(row.id, tx);
    await tx
      .insert(t.agentVersions)
      .values({
        agentId: row.id,
        version,
        configJson: {
          provider: row.provider,
          model: row.model,
          system_prompt: row.systemPrompt,
          output_schema: row.outputSchema,
          strategy: row.strategy,
          ci_fail_on: row.ciFailOn,
          repo_intel: row.repoIntel,
          skills,
        },
      })
      .onConflictDoNothing();
  }

  // ---- agent_versions (immutable config snapshots) ------------------------

  /** All config snapshots for an agent, newest version first. */
  async listVersions(agentId: string): Promise<AgentVersionRow[]> {
    return this.db
      .select()
      .from(t.agentVersions)
      .where(eq(t.agentVersions.agentId, agentId))
      .orderBy(desc(t.agentVersions.version));
  }

  /** A single config snapshot, or undefined if that version was never recorded. */
  async getVersion(agentId: string, version: number): Promise<AgentVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agentVersions)
      .where(and(eq(t.agentVersions.agentId, agentId), eq(t.agentVersions.version, version)));
    return row;
  }

  // ---- agent_skills link table (A2 owns the agent side) -------------------

  /** Skills linked to an agent (enabled or not), in `order` ascending. */
  async linkedSkills(agentId: string, db: Executor = this.db): Promise<LinkedSkillRow[]> {
    const rows = await db
      .select({ skill: t.skills, order: t.agentSkills.order, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => ({ skill: r.skill, order: r.order, enabled: r.enabled }));
  }

  /**
   * The agent's EFFECTIVE skill set for versioning: ids of link-enabled skills
   * in link order. This is what an `agent_versions` snapshot records. (A skill's
   * own global `enabled` flag is skill state, not agent config, so it is not
   * consulted here.)
   */
  async skillIdsForAgent(agentId: string, db: Executor = this.db): Promise<string[]> {
    const links = await this.linkedSkills(agentId, db);
    return links.filter((l) => l.enabled).map((l) => l.skill.id);
  }

  /**
   * Count of skills that actually reach each agent's prompt (link enabled AND
   * skill globally enabled), keyed by agent id. Agents with none are absent.
   */
  async activeSkillCounts(workspaceId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ agentId: t.agentSkills.agentId, n: count() })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agents.workspaceId, workspaceId),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .groupBy(t.agentSkills.agentId);
    return new Map(rows.map((r) => [r.agentId, Number(r.n)]));
  }

  /** The subset of `skillIds` that exist in the workspace. */
  async existingSkillIds(workspaceId: string, skillIds: string[]): Promise<Set<string>> {
    if (skillIds.length === 0) return new Set();
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, skillIds)));
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Replace the full ordered skill set of an agent (order = index, per-link
   * `enabled`). Skills not in the list are unlinked. Bumps the agent version +
   * snapshots when the effective set changes. Returns undefined when the agent
   * isn't in the workspace.
   */
  async replaceSkillLinks(
    workspaceId: string,
    agentId: string,
    links: SkillLinkInput[],
  ): Promise<AgentRow | undefined> {
    return this.mutateSkillLinks(workspaceId, agentId, async (tx) => {
      await tx.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
      if (links.length === 0) return;
      await tx.insert(t.agentSkills).values(
        links.map((l, i) => ({ agentId, skillId: l.skillId, order: i, enabled: l.enabled })),
      );
    });
  }

  /**
   * Link one skill at `order` (append when omitted), enabled. Idempotent:
   * re-linking an already-linked skill updates its order and re-enables it.
   * Same versioning rule as `replaceSkillLinks`.
   */
  async linkSkill(
    workspaceId: string,
    agentId: string,
    skillId: string,
    order?: number,
  ): Promise<AgentRow | undefined> {
    return this.mutateSkillLinks(workspaceId, agentId, async (tx) => {
      const resolvedOrder = order ?? (await this.linkedSkills(agentId, tx)).length;
      await tx
        .insert(t.agentSkills)
        .values({ agentId, skillId, order: resolvedOrder, enabled: true })
        .onConflictDoUpdate({
          target: [t.agentSkills.agentId, t.agentSkills.skillId],
          set: { order: resolvedOrder, enabled: true },
        });
    });
  }

  /**
   * Run a link-table mutation in one transaction with the agent row locked; if
   * the effective (enabled, ordered) skill set changed, bump `version` and
   * snapshot it. A no-op mutation leaves the version untouched.
   */
  private async mutateSkillLinks(
    workspaceId: string,
    agentId: string,
    mutate: (tx: Tx) => Promise<void>,
  ): Promise<AgentRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [agent] = await tx
        .select()
        .from(t.agents)
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, agentId)))
        .for('update');
      if (!agent) return undefined;

      const before = await this.skillIdsForAgent(agentId, tx);
      await mutate(tx);
      const after = await this.skillIdsForAgent(agentId, tx);
      if (sameIds(before, after)) return agent;

      const nextVersion = agent.version + 1;
      const [row] = await tx
        .update(t.agents)
        .set({ version: nextVersion })
        .where(eq(t.agents.id, agentId))
        .returning();
      await this.snapshotVersion(tx, row!, nextVersion);
      return row!;
    });
  }
}
