import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/en/shell.json";
import { InlineComposer } from "./InlineComposer";
import type { DiffCommentApi } from "../comments";

afterEach(cleanup);

function renderComposer(commenting: DiffCommentApi, onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
      <InlineComposer commenting={commenting} path="src/a.ts" line={11} side="RIGHT" onClose={onClose} />
    </NextIntlClientProvider>,
  );
  return { onClose };
}

describe("InlineComposer", () => {
  it("types a comment, posts it, and closes the composer", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { onClose } = renderComposer({ comments: [], canComment: true, showComments: true, posting: false, onSubmit });

    await user.type(screen.getByPlaceholderText(/leave a comment/i), "Looks like a leak here.");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(onSubmit).toHaveBeenCalledWith({
      path: "src/a.ts",
      line: 11,
      side: "RIGHT",
      body: "Looks like a leak here.",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not submit a blank comment, and Cancel closes without posting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { onClose } = renderComposer({ comments: [], canComment: true, showComments: true, posting: false, onSubmit });

    // The Post button stays disabled for blank/whitespace-only text.
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
