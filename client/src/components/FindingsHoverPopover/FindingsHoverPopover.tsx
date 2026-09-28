/* FindingsHoverPopover — wraps a trigger (typically SeverityCountBadges) and
   shows a hover panel listing the given findings in priority order (worst
   severity first, then highest confidence). Used by both the PR list's
   Findings column and the PR detail page's Agent-runs Timeline; those two
   call sites source `findings` differently (a lazy per-hover fetch on the
   list, already-loaded data on the Timeline), so this component stays a pure
   presentational wrapper over whatever list it's handed. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { SeverityBadge, CategoryTag, ConfidenceNum, type Severity, type Category } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { sortFindingsForPopover, truncateRationale, lineLabel } from "./helpers";

const CLOSE_DELAY_MS = 150;
const PANEL_WIDTH = 440;
const VIEWPORT_MARGIN = 12;
/** Below this much room, flip the panel to open upward instead of downward. */
const MIN_SPACE_BELOW = 220;

type PanelPos = { left: number; top?: number; bottom?: number };

/** Fixed-position coordinates for the panel, computed from the trigger's
 *  current bounding rect and clamped to the viewport (so the panel escapes
 *  any ancestor's `overflow: hidden`, e.g. the PR list's table card). */
function computePanelPos(trigger: HTMLElement): PanelPos {
  const rect = trigger.getBoundingClientRect();
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
  );
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < MIN_SPACE_BELOW && rect.top > spaceBelow) {
    return { left, bottom: window.innerHeight - rect.top + 6 };
  }
  return { left, top: rect.bottom + 6 };
}

export function FindingsHoverPopover({
  findings,
  loading,
  disabled,
  onHoverChange,
  children,
}: {
  findings: FindingRecord[];
  /** Shows a loading row instead of the list (PR-list's lazy hover-fetch). */
  loading?: boolean;
  /** Hover never opens the panel (Timeline: suppressed while the run's trace
   *  drawer is open). The trigger itself still renders normally. */
  disabled?: boolean;
  /** Fires as hover starts/ends — lets a caller lazily fetch `findings` only
   *  while hovered (PR list) instead of loading it upfront for every row. */
  onHoverChange?: (hovering: boolean) => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("prReview");
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<PanelPos | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const handleEnter = React.useCallback(() => {
    onHoverChange?.(true);
    if (disabled) return;
    clearCloseTimer();
    if (wrapperRef.current) setPos(computePanelPos(wrapperRef.current));
    setOpen(true);
  }, [disabled, clearCloseTimer, onHoverChange]);

  const handleLeave = React.useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      onHoverChange?.(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, onHoverChange]);

  React.useEffect(() => clearCloseTimer, [clearCloseTimer]);
  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  // Re-clamp position on resize/scroll while open — the trigger's on-screen
  // spot can move (window resize, or the PR list/timeline scrolling).
  React.useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (wrapperRef.current) setPos(computePanelPos(wrapperRef.current));
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const sorted = React.useMemo(() => sortFindingsForPopover(findings), [findings]);

  const panel = open && !disabled && pos && (
    <div
      role="tooltip"
      onMouseEnter={clearCloseTimer}
      onMouseLeave={handleLeave}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        bottom: pos.bottom,
        zIndex: 1000,
        width: PANEL_WIDTH,
        maxHeight: 400,
        overflowY: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-modal)",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {t("findingsPopover.total", { count: sorted.length })}
      </div>
      {loading ? (
        <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text-muted)" }}>
          {t("findingsPopover.loading")}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text-muted)" }}>
          {t("findingsPopover.empty")}
        </div>
      ) : (
        sorted.map((f) => (
          <div key={f.id} style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SeverityBadge severity={f.severity as Severity} compact />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.title}
              </span>
              <CategoryTag category={f.category as Category} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {f.file}:{lineLabel(f)}
              </span>
              <ConfidenceNum value={f.confidence} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {truncateRationale(f.rationale)}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
