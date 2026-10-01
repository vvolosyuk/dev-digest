import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../messages/en/prReview.json";

import { FindingsHoverPopover } from "./FindingsHoverPopover";
import { sortFindingsForPopover, truncateRationale } from "./helpers";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "WARNING",
    category: "perf",
    title: "N+1 query",
    file: "a.ts",
    start_line: 10,
    end_line: 12,
    rationale: "x".repeat(200),
    suggestion: null,
    confidence: 0.7,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
  {
    id: "f2",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "b.ts",
    start_line: 5,
    end_line: 5,
    rationale: "short",
    suggestion: null,
    confidence: 0.98,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

describe("sortFindingsForPopover", () => {
  it("sorts by severity rank, then confidence descending within the same severity", () => {
    expect(sortFindingsForPopover(FINDINGS).map((f) => f.id)).toEqual(["f2", "f1"]);
  });
});

describe("truncateRationale", () => {
  it("passes short text through unchanged", () => {
    expect(truncateRationale("short")).toBe("short");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "x".repeat(200);
    const out = truncateRationale(long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(long.length);
  });
});

describe("FindingsHoverPopover", () => {
  it("opens on hover and lists findings sorted by priority", () => {
    renderWithIntl(
      <FindingsHoverPopover findings={FINDINGS}>
        <span>trigger</span>
      </FindingsHoverPopover>,
    );
    fireEvent.mouseEnter(screen.getByText("trigger").parentElement!);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
  });

  it("never opens while disabled", () => {
    renderWithIntl(
      <FindingsHoverPopover findings={FINDINGS} disabled>
        <span>trigger</span>
      </FindingsHoverPopover>,
    );
    fireEvent.mouseEnter(screen.getByText("trigger").parentElement!);
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
  });

  it("closes after the mouse-leave delay", () => {
    vi.useFakeTimers();
    renderWithIntl(
      <FindingsHoverPopover findings={FINDINGS}>
        <span>trigger</span>
      </FindingsHoverPopover>,
    );
    const wrapper = screen.getByText("trigger").parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
