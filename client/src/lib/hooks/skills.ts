/* hooks/skills.ts — React Query hooks for the L02 Skills page and the Agent
   Editor's Skills tab. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentSkillLink,
  Skill,
  SkillImportPreview,
  SkillSource,
  SkillType,
  SkillVersion,
} from "@devdigest/shared";

export function useSkills(q?: string) {
  const query = q?.trim() ?? "";
  return useQuery({
    queryKey: ["skills", query],
    queryFn: () =>
      api.get<Skill[]>(query ? `/skills?q=${encodeURIComponent(query)}` : "/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: Extract<SkillSource, "manual" | "imported_url">;
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">> & {
    /** Optional change note stored on the new version snapshot. */
    note?: string;
  };
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.del<{ ok: boolean; unlinked_agents: number }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
    },
  });
}

/** Agents that link a skill (delete-confirm). */
export function useSkillAgents(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-agents", id],
    queryFn: () => api.get<{ id: string; name: string }[]>(`/skills/${id}/agents`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useSkillVersion(id: string | null | undefined, version: number | null | undefined) {
  return useQuery({
    queryKey: ["skill-version", id, version],
    queryFn: () => api.get<SkillVersion>(`/skills/${id}/versions/${version}`),
    enabled: !!id && version != null,
  });
}

export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export interface ImportSkillPreviewInput {
  filename: string;
  /** File bytes, base64-encoded (no data: URL prefix). */
  content_base64: string;
}

/** Parses an uploaded .md/.zip server-side — persists nothing. */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: (input: ImportSkillPreviewInput) =>
      api.post<SkillImportPreview>("/skills/import/preview", input),
  });
}

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

export interface SetAgentSkillsInput {
  agentId: string;
  /** The full ordered set (order = index). */
  links: { skill_id: string; enabled: boolean }[];
}

/** Replace an agent's skill links. Optimistic: the list reorders immediately. */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, links }: SetAgentSkillsInput) =>
      api.put<AgentSkillLink[]>(`/agents/${agentId}/skills`, { links }),
    onMutate: async ({ agentId, links }) => {
      const key = ["agent-skills", agentId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AgentSkillLink[]>(key);
      qc.setQueryData<AgentSkillLink[]>(
        key,
        links.map((l, order) => ({ agent_id: agentId, skill_id: l.skill_id, enabled: l.enabled, order })),
      );
      return { previous };
    },
    onError: (_e, { agentId }, ctx) => {
      if (ctx?.previous) qc.setQueryData(["agent-skills", agentId], ctx.previous);
    },
    onSettled: (_d, _e, { agentId }) => {
      qc.invalidateQueries({ queryKey: ["agent-skills", agentId] });
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
