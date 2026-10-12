import type { Skill, SkillSource } from '@devdigest/shared';
import type { SkillRow } from '../../db/rows.js';

/**
 * Map a persisted skill row to the public `Skill` DTO. Shared by the skills
 * module and the conventions extractor (which creates `extracted` skills).
 */
export function toSkillDto(row: SkillRow, agentCount?: number): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    ...(agentCount !== undefined ? { agent_count: agentCount } : {}),
    updated_at: row.updatedAt.toISOString(),
  };
}
