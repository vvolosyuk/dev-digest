import { describe, it, expect } from "vitest";
import { estimateTokens, lineCount } from "./helpers";

describe("estimateTokens", () => {
  it("is ceil(chars / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("lineCount", () => {
  it("counts lines, with an empty body being one line", () => {
    expect(lineCount("")).toBe(1);
    expect(lineCount("a\nb")).toBe(2);
    expect(lineCount("a\nb\n")).toBe(3);
  });
});
