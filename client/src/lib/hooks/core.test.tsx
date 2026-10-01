/**
 * Smoke coverage for the real `useQuery`/`useMutation` wiring in
 * `hooks/core.ts` — every existing hook test mocks these hooks out entirely,
 * so the actual query key / fetch call / cache-invalidation wiring was never
 * directly exercised. Mocks only `../api` (the network boundary), not the
 * hooks under test.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRepos, useAddRepo } from "./core";
import { api } from "../api";
import type { Repo } from "../types";

vi.mock("../api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { qc, Wrapper: ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  ) };
}

const REPO: Repo = {
  id: "r1",
  workspace_id: "w1",
  owner: "acme",
  name: "widgets",
  full_name: "acme/widgets",
  default_branch: "main",
  clone_path: null,
  last_polled_at: null,
  created_by: null,
};

describe("useRepos", () => {
  it("calls GET /repos and populates query data under the ['repos'] key", async () => {
    vi.mocked(api.get).mockResolvedValue([REPO]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useRepos(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/repos");
    expect(result.current.data).toEqual([REPO]);
  });
});

describe("useAddRepo", () => {
  it("posts the new repo URL and invalidates the repos list on success", async () => {
    vi.mocked(api.get).mockResolvedValue([REPO]);
    vi.mocked(api.post).mockResolvedValue(REPO);
    const { Wrapper, qc } = wrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result: repos } = renderHook(() => useRepos(), { wrapper: Wrapper });
    await waitFor(() => expect(repos.current.isSuccess).toBe(true));

    const { result: add } = renderHook(() => useAddRepo(), { wrapper: Wrapper });
    add.current.mutate("https://github.com/acme/widgets");

    await waitFor(() => expect(add.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith("/repos", { url: "https://github.com/acme/widgets" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["repos"] });
  });
});
