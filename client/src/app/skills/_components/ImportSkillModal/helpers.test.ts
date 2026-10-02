import { describe, it, expect } from "vitest";
import { readFileAsBase64, stripDataUrlPrefix } from "./helpers";

describe("stripDataUrlPrefix", () => {
  it("drops the data URL header", () => {
    expect(stripDataUrlPrefix("data:text/markdown;base64,IyBSdWxl")).toBe("IyBSdWxl");
    expect(stripDataUrlPrefix("data:application/octet-stream;base64,")).toBe("");
  });

  it("leaves bare base64 untouched", () => {
    expect(stripDataUrlPrefix("IyBSdWxl")).toBe("IyBSdWxl");
  });
});

describe("readFileAsBase64", () => {
  it("reads a file to bare base64", async () => {
    const file = new File(["# Rule"], "rule.md", { type: "text/markdown" });
    expect(await readFileAsBase64(file)).toBe(btoa("# Rule"));
  });
});
