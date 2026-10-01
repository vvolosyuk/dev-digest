import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SeverityCountBadges } from "./SeverityCountBadges";

afterEach(cleanup);

describe("SeverityCountBadges", () => {
  it("renders an em-dash when every count is zero", () => {
    render(<SeverityCountBadges counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders only the non-zero severities, in CRITICAL → WARNING → SUGGESTION order", () => {
    render(<SeverityCountBadges counts={{ CRITICAL: 2, WARNING: 0, SUGGESTION: 3 }} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
