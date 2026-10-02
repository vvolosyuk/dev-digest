import type { AgentSkillLink, Skill } from "@devdigest/shared";

/** One entry of the `PUT /agents/:id/skills` payload (order = array index). */
export interface LinkInput {
  skill_id: string;
  enabled: boolean;
}

/** A row in the Skills tab: a workspace skill plus its link to this agent, if any. */
export interface SkillRowModel {
  skill: Skill;
  link: AgentSkillLink | null;
}

/** Links sorted by `order`, reduced to the payload shape. */
export function toOrderedLinks(links: readonly AgentSkillLink[]): LinkInput[] {
  return [...links]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ skill_id: l.skill_id, enabled: l.enabled }));
}

/** Linked skills first (in link order), then unlinked ones by name. */
export function buildRows(skills: readonly Skill[], links: readonly AgentSkillLink[]): SkillRowModel[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linkById = new Map(links.map((l) => [l.skill_id, l]));
  const linked = [...links]
    .sort((a, b) => a.order - b.order)
    .flatMap((l) => {
      const skill = byId.get(l.skill_id);
      return skill ? [{ skill, link: l }] : [];
    });
  const unlinked = skills
    .filter((sk) => !linkById.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, link: null }));
  return [...linked, ...unlinked];
}

/** Checkbox semantics: unlinked → append as enabled; linked → flip `enabled` in place. */
export function toggleLink(links: readonly LinkInput[], skillId: string): LinkInput[] {
  if (!links.some((l) => l.skill_id === skillId)) return [...links, { skill_id: skillId, enabled: true }];
  return links.map((l) => (l.skill_id === skillId ? { ...l, enabled: !l.enabled } : l));
}

/** Move a linked skill by `delta` positions (clamped); no-op if not linked. */
export function moveLink(links: readonly LinkInput[], skillId: string, delta: number): LinkInput[] {
  const from = links.findIndex((l) => l.skill_id === skillId);
  if (from < 0) return [...links];
  const to = Math.max(0, Math.min(links.length - 1, from + delta));
  return moveIndex(links, from, to);
}

/** Drag-and-drop: move `fromId` into `toId`'s position; no-op unless both are linked. */
export function moveLinkTo(links: readonly LinkInput[], fromId: string, toId: string): LinkInput[] {
  const from = links.findIndex((l) => l.skill_id === fromId);
  const to = links.findIndex((l) => l.skill_id === toId);
  if (from < 0 || to < 0) return [...links];
  return moveIndex(links, from, to);
}

function moveIndex(links: readonly LinkInput[], from: number, to: number): LinkInput[] {
  const next = [...links];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
}

/** Case-insensitive match on name/description. */
export function matchesFilter(skill: Skill, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return skill.name.toLowerCase().includes(needle) || skill.description.toLowerCase().includes(needle);
}
