import { describe, it, expect } from "vitest";
import { hasChanges, lineDiff } from "./helpers";

describe("lineDiff", () => {
  it("returns only kept lines for identical text", () => {
    const d = lineDiff("a\nb", "a\nb");
    expect(d).toEqual([
      { kind: "same", text: "a" },
      { kind: "same", text: "b" },
    ]);
    expect(hasChanges(d)).toBe(false);
  });

  it("marks a changed line as delete + add, keeping the common lines", () => {
    expect(lineDiff("# Rule\nold line\nend", "# Rule\nnew line\nend")).toEqual([
      { kind: "same", text: "# Rule" },
      { kind: "del", text: "old line" },
      { kind: "add", text: "new line" },
      { kind: "same", text: "end" },
    ]);
  });

  it("handles pure additions and deletions at the edges", () => {
    expect(lineDiff("b", "a\nb\nc")).toEqual([
      { kind: "add", text: "a" },
      { kind: "same", text: "b" },
      { kind: "add", text: "c" },
    ]);
    expect(lineDiff("a\nb\nc", "b")).toEqual([
      { kind: "del", text: "a" },
      { kind: "same", text: "b" },
      { kind: "del", text: "c" },
    ]);
  });

  it("finds the longest common subsequence, not just a prefix match", () => {
    const d = lineDiff("x\na\nb\nc", "a\nb\nc\ny");
    expect(d.filter((l) => l.kind === "same").map((l) => l.text)).toEqual(["a", "b", "c"]);
    expect(d.filter((l) => l.kind === "del").map((l) => l.text)).toEqual(["x"]);
    expect(d.filter((l) => l.kind === "add").map((l) => l.text)).toEqual(["y"]);
  });
});
