/* hooks/conventions.ts — React Query hooks for the L02 Conventions extractor
   (/repos/:repoId/conventions). The vendored `ConventionCandidate` contract
   predates category/line ranges/review status, so the richer DTO is typed
   locally here (mirrors `server/src/modules/conventions/helpers.ts`). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Skill, SkillType } from "@devdigest/shared";
import { api } from "../api";

export type ConventionStatus = "pending" | "accepted" | "rejected";

export interface Convention {
  id: string;
  category: string;
  rule: string;
  evidence_path: string;
  evidence_line_start: number;
  evidence_line_end: number;
  evidence_snippet: string;
  confidence: number;
  status: ConventionStatus;
  accepted: boolean;
  created_at: string;
}

export interface ConventionsList {
  candidates: Convention[];
  last_scan_at: string | null;
}

export interface ExtractConventionsResult extends ConventionsList {
  sampled_files: number;
  /** Candidates dropped because their evidence didn't match a real file/line. */
  discarded: number;
  /** New candidates skipped because an accepted/rejected one has the same rule. */
  duplicates: number;
  model: string;
}

const key = (repoId: string) => ["conventions", repoId] as const;

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: key(repoId ?? ""),
    queryFn: () => api.get<ConventionsList>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ExtractConventionsResult>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (data) => {
      qc.setQueryData<ConventionsList>(key(repoId), {
        candidates: data.candidates,
        last_scan_at: data.last_scan_at,
      });
    },
  });
}

export interface UpdateConventionInput {
  id: string;
  patch: Partial<Pick<Convention, "status" | "rule" | "category">>;
}

/** Optimistic accept/reject/edit; rolls back on error. */
export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) => api.patch<Convention>(`/conventions/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key(repoId) });
      const prev = qc.getQueryData<ConventionsList>(key(repoId));
      if (prev) {
        qc.setQueryData<ConventionsList>(key(repoId), {
          ...prev,
          candidates: prev.candidates.map((c) =>
            c.id === id
              ? { ...c, ...patch, accepted: (patch.status ?? c.status) === "accepted" }
              : c,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key(repoId), ctx.prev);
    },
    onSuccess: (saved) => {
      qc.setQueryData<ConventionsList>(key(repoId), (cur) =>
        cur ? { ...cur, candidates: cur.candidates.map((c) => (c.id === saved.id ? saved : c)) } : cur,
      );
    },
  });
}

export interface CreateConventionsSkillInput {
  name: string;
  description: string;
  type: SkillType;
  enabled: boolean;
  body: string;
  convention_ids: string[];
  /** Name taken: `fail` (default) → 409 with `SkillNameConflict` details; `new_version` → bump that skill. */
  on_conflict?: "fail" | "new_version";
}

/** `ApiError.details` of a 409 from `POST …/conventions/skill`. */
export interface SkillNameConflict {
  name: string;
  skill_id: string;
  version: number;
}

/** Merge accepted conventions into one `extracted` skill, or a new version of a same-named one (not linked to any agent). */
export function useCreateSkillFromConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionsSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export interface ConventionsSkillDraft {
  description: string;
  body: string;
  /** `template` when the LLM was unavailable or failed — see `warning`. */
  generated_by: "llm" | "template";
  model?: string;
  warning?: string;
}

/**
 * LLM-drafted description + body (`# <name>` heading) for the merged skill;
 * the server falls back to a template. A QUERY, not a mutation: it persists
 * nothing and loads on open — a `mutate()` fired from a mount effect never
 * settles under React StrictMode (the dev double-mount detaches the
 * MutationObserver from the in-flight mutation). Regenerate = `refetch()`.
 * Never cached across opens (`gcTime: 0`), never auto-refetched.
 */
export function useConventionsSkillDraft(repoId: string, conventionIds: readonly string[], name: string) {
  return useQuery({
    queryKey: ["conventions-skill-draft", repoId, conventionIds, name],
    queryFn: () =>
      api.post<ConventionsSkillDraft>(`/repos/${repoId}/conventions/skill-draft`, {
        convention_ids: conventionIds,
        name,
      }),
    enabled: conventionIds.length > 0,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
