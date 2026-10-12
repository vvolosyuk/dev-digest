import type { SkillType } from '@devdigest/shared';

/** The fields of a skill that are rendered into the review prompt. */
export interface SkillPromptFields {
  name: string;
  type: SkillType;
  version: number;
  description: string;
  body: string;
}

/**
 * Render one skill as the block the reviewing agent receives. reviewer-core
 * joins these with `\n\n` under `## Skills / rules`. Shared by the skills module
 * and the review run-executor; the client mirrors this format in its Preview
 * tab — keep both in sync.
 */
export function formatSkillBlock(s: SkillPromptFields): string {
  return `### Skill: ${s.name} (${s.type}, v${s.version})\n${s.description}\n\n${s.body.trim()}`;
}
