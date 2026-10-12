import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../../../lib/repo-context", () => ({
  useActiveRepo: () => ({ repoId: "repo-1" }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
});

function mount() {
  const onOpenPalette = vi.fn();
  const onOpenHelp = vi.fn();
  renderHook(() => useGlobalShortcuts({ onOpenPalette, onOpenHelp }));
  return { onOpenPalette, onOpenHelp };
}

describe("useGlobalShortcuts", () => {
  it("opens the command palette on Ctrl/Cmd+K", async () => {
    const user = userEvent.setup();
    const { onOpenPalette } = mount();
    await user.keyboard("{Control>}k{/Control}");
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it("opens shortcuts help on '?'", async () => {
    const user = userEvent.setup();
    const { onOpenHelp } = mount();
    await user.keyboard("?");
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it("navigates via the g-then-key chord (g a → Agents, g , → Settings)", async () => {
    const user = userEvent.setup();
    mount();
    await user.keyboard("ga");
    expect(push).toHaveBeenCalledWith("/agents");

    push.mockClear();
    await user.keyboard("g,");
    expect(push).toHaveBeenCalledWith("/settings/api-keys");
  });
});
