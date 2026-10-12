import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Convention, ConventionsSkillDraft } from "@/lib/hooks/conventions";
import { ApiError } from "@/lib/api";
import { ToastProvider } from "@/lib/toast";
import conventions from "../../../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../../../messages/en/skills.json";

const LLM_DRAFT: ConventionsSkillDraft = {
  description: "Flag async-style deviations from payments-api conventions. Use when the diff edits src/api/ handlers.",
  body: "# payments-api-conventions\n\n## When to use\n\n- The diff edits src/api/.\n",
  generated_by: "llm",
  model: "gpt-5.4-mini",
};

let draftResult: ConventionsSkillDraft = LLM_DRAFT;
let draftPending = false;
const draftHook = vi.fn();
const refetch = vi.fn();
const createMutate = vi.fn();

vi.mock("@/lib/hooks/conventions", () => ({
  useCreateSkillFromConventions: () => ({ mutate: createMutate, isPending: false }),
  useConventionsSkillDraft: (...args: unknown[]) => {
    draftHook(...args);
    return draftPending
      ? { data: undefined, dataUpdatedAt: 0, isFetching: true, isError: false, error: null, refetch }
      : { data: draftResult, dataUpdatedAt: 1, isFetching: false, isError: false, error: null, refetch };
  },
}));

import { CreateConventionsSkillModal } from "./CreateConventionsSkillModal";

const ACCEPTED: Convention[] = [
  {
    id: "c1",
    category: "async",
    rule: "Always use async/await instead of .then() chains",
    evidence_path: "src/api/users.ts",
    evidence_line_start: 23,
    evidence_line_end: 23,
    evidence_snippet: "const user = await db.users.find(id);",
    confidence: 0.91,
    status: "accepted",
    accepted: true,
    created_at: "2026-10-01T00:00:00.000Z",
  },
];

function renderModal() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>
        <CreateConventionsSkillModal
          repoId="r1"
          repoFullName="acme/payments-api"
          accepted={ACCEPTED}
          onClose={onClose}
          onCreated={onCreated}
        />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose, onCreated };
}

beforeEach(() => {
  draftResult = LLM_DRAFT;
  draftPending = false;
  draftHook.mockClear();
  refetch.mockClear();
  createMutate.mockReset();
});
afterEach(cleanup);

describe("CreateConventionsSkillModal", () => {
  it("loads the draft for the accepted ids on open and fills description + body from it", () => {
    renderModal();
    expect(draftHook).toHaveBeenCalledWith("r1", ["c1"], "payments-api-conventions");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("payments-api-conventions");
    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe(LLM_DRAFT.description);
    expect((screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement).value).toBe(LLM_DRAFT.body);
    expect(screen.getByText("Drafted with gpt-5.4-mini — review before saving.")).toBeTruthy();
  });

  it("renaming the skill retitles the body heading", async () => {
    const user = userEvent.setup();
    renderModal();
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "conventions");
    const body = (screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement).value;
    expect(body.startsWith("# conventions\n\n## When to use")).toBe(true);
  });

  it("shows a drafting state and blocks Create while the draft is pending", () => {
    draftPending = true;
    renderModal();
    expect(screen.getByText("Drafting the skill description and body…")).toBeTruthy();
    expect(screen.queryByLabelText("Skill body (Markdown)")).toBeNull();
    expect((screen.getByRole("button", { name: "Create skill" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("warns when the server fell back to the template", () => {
    draftResult = { ...LLM_DRAFT, generated_by: "template", model: undefined, warning: "401 Incorrect API key" };
    renderModal();
    expect(screen.getByRole("alert").textContent).toMatch(/template was used \(401 Incorrect API key\)/);
  });

  it("Regenerate refetches the draft, confirming before discarding edits", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderModal();
    await user.click(screen.getByRole("button", { name: "Regenerate draft" }));
    expect(refetch).toHaveBeenCalledTimes(1); // unedited → no confirm
    expect(confirm).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Description"), " Extra.");
    await user.click(screen.getByRole("button", { name: "Regenerate draft" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1); // declined
    confirm.mockRestore();
  });

  it("creates the skill with the edited values and the accepted ids", async () => {
    const user = userEvent.setup();
    renderModal();
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "payments-rules");
    await user.click(screen.getByRole("button", { name: "Create skill" }));
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      name: "payments-rules",
      description: LLM_DRAFT.description,
      body: LLM_DRAFT.body.replace("# payments-api-conventions", "# payments-rules"),
      type: "convention",
      enabled: true,
      convention_ids: ["c1"],
    });
  });

  it("blocks invalid input", async () => {
    const user = userEvent.setup();
    renderModal();
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Bad Name");
    await user.click(screen.getByRole("button", { name: "Create skill" }));
    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/lowercase/i);
  });

  describe("name already taken (409)", () => {
    const conflictOnFirstCall = () =>
      createMutate.mockImplementationOnce((_v: unknown, opts: { onError: (e: unknown) => void }) =>
        opts.onError(
          new ApiError("exists", 409, "conflict", { name: "payments-api-conventions", skill_id: "s1", version: 3 }),
        ),
      );

    it("asks whether to save a new version; confirming re-saves with on_conflict=new_version", async () => {
      const user = userEvent.setup();
      const { onCreated } = renderModal();
      conflictOnFirstCall();
      await user.click(screen.getByRole("button", { name: "Create skill" }));

      const dialog = screen.getByRole("alertdialog");
      expect(dialog.textContent).toMatch(/"payments-api-conventions" already exists \(v3\)/);
      createMutate.mockImplementationOnce((_v: unknown, opts: { onSuccess: (s: unknown) => void }) =>
        opts.onSuccess({ id: "s1", name: "payments-api-conventions", version: 4 }),
      );
      await user.click(screen.getByRole("button", { name: "Save as v4" }));

      expect(createMutate).toHaveBeenCalledTimes(2);
      expect(createMutate.mock.calls[0]![0]).toMatchObject({ on_conflict: "fail" });
      expect(createMutate.mock.calls[1]![0]).toMatchObject({ on_conflict: "new_version", convention_ids: ["c1"] });
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "s1", version: 4 }));
    });

    it("Discard closes without saving anything", async () => {
      const user = userEvent.setup();
      const { onClose, onCreated } = renderModal();
      conflictOnFirstCall();
      await user.click(screen.getByRole("button", { name: "Create skill" }));
      await user.click(screen.getByRole("button", { name: "Discard" }));
      expect(onClose).toHaveBeenCalled();
      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(onCreated).not.toHaveBeenCalled();
    });

    it("renaming away from the taken name drops the question", async () => {
      const user = userEvent.setup();
      renderModal();
      conflictOnFirstCall();
      await user.click(screen.getByRole("button", { name: "Create skill" }));
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      await user.type(screen.getByLabelText("Name"), "-v2");
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.getByRole("button", { name: "Create skill" })).toBeTruthy();
    });
  });

  it("Cancel closes without saving", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
