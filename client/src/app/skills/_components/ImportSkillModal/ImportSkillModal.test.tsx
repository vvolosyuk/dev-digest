import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../lib/toast";

const PREVIEW: SkillImportPreview = {
  name: "flaky-tests",
  description: "Flag tests that depend on timing, order or network.",
  type: "rubric",
  body: "# Flaky tests\nLook for `sleep()` in tests.",
  warnings: ["frontmatter has no type — defaulted to rubric"],
  ignored_files: [
    { path: "flaky-tests/scripts/detect.sh", reason: "executable" },
    { path: "flaky-tests/references/notes.txt", reason: "not-skill-core" },
  ],
  conflict: false,
};

let preview: SkillImportPreview = PREVIEW;
const previewMutate = vi.fn((_input: unknown, opts?: { onSuccess?: (p: SkillImportPreview) => void }) =>
  opts?.onSuccess?.(preview),
);
const createMutate = vi.fn();

vi.mock("../../../../lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({ mutate: previewMutate, isPending: false, error: null }),
  useCreateSkill: () => ({ mutate: createMutate, isPending: false }),
}));

import { ImportSkillModal } from "./ImportSkillModal";

function renderModal(onClose = vi.fn(), onSaved = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ImportSkillModal onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved };
}

async function uploadZip(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["PK\x03\x04fake"], "flaky-tests.zip", { type: "application/zip" });
  await user.upload(screen.getByLabelText("Skill file"), file);
  return screen.findByText("Ignored files");
}

beforeEach(() => {
  preview = PREVIEW;
  previewMutate.mockClear();
  createMutate.mockReset();
});
afterEach(cleanup);

describe("ImportSkillModal", () => {
  it("sends the file as base64 and shows the preview with ignored files", async () => {
    const user = userEvent.setup();
    renderModal();
    await uploadZip(user);

    expect(previewMutate).toHaveBeenCalledTimes(1);
    const input = previewMutate.mock.calls[0]![0] as { filename: string; content_base64: string };
    expect(input.filename).toBe("flaky-tests.zip");
    expect(input.content_base64).not.toMatch(/^data:/);

    expect(screen.getByText(/someone else.s instructions that will run inside your agent.s prompt/)).toBeInTheDocument();
    expect(screen.getByText("flaky-tests/scripts/detect.sh")).toBeInTheDocument();
    expect(screen.getByText("executable — not run")).toBeInTheDocument();
    expect(screen.getByText("frontmatter has no type — defaulted to rubric")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("flaky-tests");
    // Previewing persists nothing.
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("saves only after an explicit Save click, as an imported skill", async () => {
    const user = userEvent.setup();
    renderModal();
    await uploadZip(user);
    expect(createMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save skill" }));
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]![0]).toEqual({
      name: "flaky-tests",
      description: PREVIEW.description,
      type: "rubric",
      body: PREVIEW.body,
      source: "imported_url",
    });
  });

  it("Cancel closes without creating anything", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await uploadZip(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("flags a name conflict until the skill is renamed", async () => {
    const user = userEvent.setup();
    preview = { ...PREVIEW, conflict: true };
    renderModal();
    await uploadZip(user);

    expect(screen.getByText(/already exists — rename it to import/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save skill" })).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "-v2");
    expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save skill" }));
    expect(createMutate.mock.calls[0]![0]).toMatchObject({ name: "flaky-tests-v2" });
  });
});
