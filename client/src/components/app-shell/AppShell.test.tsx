import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./hooks", () => ({
  useGlobalShortcuts: vi.fn(),
  useShellCommands: () => [],
  // Pass the real `onOpenCommandPalette` through so the test can exercise
  // AppShell's actual open/close wiring, not a disconnected stub.
  useShellContext: (opts: { onOpenCommandPalette: () => void }) => ({
    onOpenCommandPalette: opts.onOpenCommandPalette,
  }),
}));

vi.mock("@devdigest/ui", () => ({
  NAV: [],
  SHORTCUTS: [],
  AppFrame: ({ children, ctx }: { children: React.ReactNode; ctx: { onOpenCommandPalette: () => void } }) => (
    <div>
      <button onClick={ctx.onOpenCommandPalette}>open-palette-trigger</button>
      {children}
    </div>
  ),
  CommandPalette: ({ open }: { open: boolean }) => (open ? <div>command-palette-open</div> : null),
  ShortcutsHelp: ({ open }: { open: boolean }) => (open ? <div>shortcuts-help-open</div> : null),
}));

import { AppShell } from "./AppShell";

afterEach(cleanup);

describe("AppShell", () => {
  it("renders its children and opens the command palette via the shell context callback", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.queryByText("command-palette-open")).not.toBeInTheDocument();

    await user.click(screen.getByText("open-palette-trigger"));
    expect(screen.getByText("command-palette-open")).toBeInTheDocument();
  });
});
