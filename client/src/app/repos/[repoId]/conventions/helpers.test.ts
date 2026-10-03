import { describe, it, expect } from "vitest";
import type { Convention } from "@/lib/hooks/conventions";
import {
  confidenceColor,
  defaultSkillName,
  evidenceRef,
  renameBodyHeading,
  shortRepoName,
  sortConventions,
} from "./helpers";

const conv = (over: Partial<Convention> = {}): Convention => ({
  id: "c1",
  category: "async",
  rule: "Always use async/await instead of .then() chains",
  evidence_path: "src/api/users.ts",
  evidence_line_start: 23,
  evidence_line_end: 24,
  evidence_snippet: "const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });",
  confidence: 0.91,
  status: "accepted",
  accepted: true,
  created_at: "2026-10-01T00:00:00.000Z",
  ...over,
});

describe("naming", () => {
  it("derives a valid default skill name from owner/name", () => {
    expect(shortRepoName("acme/payments-api")).toBe("payments-api");
    expect(defaultSkillName("acme/payments-api")).toBe("payments-api-conventions");
    expect(defaultSkillName("acme/My_Repo.JS")).toBe("my-repo-js-conventions");
    const long = defaultSkillName(`acme/${"x".repeat(80)}`);
    expect(long.length).toBeLessThanOrEqual(63);
    expect(long).toMatch(/^[a-z0-9][a-z0-9-]{1,62}$/);
  });
});

describe("evidenceRef / confidenceColor", () => {
  it("formats single lines and ranges", () => {
    expect(evidenceRef(conv())).toBe("src/api/users.ts:23-24");
    expect(evidenceRef(conv({ evidence_line_end: 23 }))).toBe("src/api/users.ts:23");
  });
  it("maps confidence to ok / warn / crit", () => {
    expect(confidenceColor(0.91)).toBe("var(--ok)");
    expect(confidenceColor(0.7)).toBe("var(--warn)");
    expect(confidenceColor(0.3)).toBe("var(--crit)");
  });
});

describe("sortConventions", () => {
  it("sinks rejected, otherwise highest confidence first", () => {
    const sorted = sortConventions([
      conv({ id: "a", confidence: 0.5, status: "pending" }),
      conv({ id: "b", confidence: 0.99, status: "rejected" }),
      conv({ id: "c", confidence: 0.8, status: "accepted" }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });
});

describe("renameBodyHeading", () => {
  it("retitles a body whose heading still matches the old name", () => {
    expect(renameBodyHeading("# old-name\n\nbody", "old-name", "conventions")).toBe("# conventions\n\nbody");
  });
  it("leaves a hand-edited heading alone", () => {
    expect(renameBodyHeading("# My title\n\nbody", "old-name", "conventions")).toBe("# My title\n\nbody");
  });
});
