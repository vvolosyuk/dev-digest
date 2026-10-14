/* hooks/intent.ts — React Query hooks for the PR intent (GET/POST /pulls/:id/intent). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { IntentResponse } from "../types";

/** The stored intent for a PR. GET never triggers an LLM call server-side. */
export function usePrIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-intent", prId],
    queryFn: () => api.get<IntentResponse>(`/pulls/${prId}/intent`),
    enabled: !!prId,
  });
}

/** (Re)derive the intent now; the response replaces the cached query data. */
export function useRecomputeIntent(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<IntentResponse>(`/pulls/${prId}/intent`),
    onSuccess: (data) => qc.setQueryData(["pr-intent", prId], data),
  });
}
