import { describe, it, expect } from "vitest";
import { formatSkillBlock, needsVetting, validateSkillForm } from "./helpers";

describe("formatSkillBlock (mirror of server helpers.formatSkillBlock)", () => {
  it("renders the heading, description and trimmed body", () => {
    expect(
      formatSkillBlock({
        name: "untested-branches",
        type: "rubric",
        version: 3,
        description: "Flag new branches without tests.",
        body: "\n- Check every `if`.\n\n",
      }),
    ).toBe("### Skill: untested-branches (rubric, v3)\nFlag new branches without tests.\n\n- Check every `if`.");
  });
});

describe("needsVetting", () => {
  it("is true only for imported skills that were never edited", () => {
    expect(needsVetting({ source: "imported_url", version: 1 })).toBe(true);
    expect(needsVetting({ source: "imported_url", version: 2 })).toBe(false);
    expect(needsVetting({ source: "manual", version: 1 })).toBe(false);
  });
});

describe("validateSkillForm", () => {
  const ok = { name: "over-mocking", description: "Flag tests that mock everything.", body: "# Rule" };

  it("accepts a valid form", () => {
    expect(validateSkillForm(ok)).toEqual({});
  });

  it("rejects bad names", () => {
    expect(validateSkillForm({ ...ok, name: "Over Mocking" }).name).toBe("nameFormat");
    expect(validateSkillForm({ ...ok, name: "-lead" }).name).toBe("nameFormat");
    expect(validateSkillForm({ ...ok, name: "a" }).name).toBe("nameFormat");
  });

  it("enforces description length 10–300", () => {
    expect(validateSkillForm({ ...ok, description: "too short" }).description).toBe("descriptionLength");
    expect(validateSkillForm({ ...ok, description: "x".repeat(301) }).description).toBe("descriptionLength");
  });

  it("requires a body of at most 20k chars", () => {
    expect(validateSkillForm({ ...ok, body: "   " }).body).toBe("bodyRequired");
    expect(validateSkillForm({ ...ok, body: "x".repeat(20_001) }).body).toBe("bodyTooLong");
  });
});
