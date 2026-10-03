/* ConventionCard — one extracted convention: rule + category, the verified
   evidence (file:lines + snippet taken from the file), confidence bar and
   Accept / Reject toggles (clicking the active one resets to pending).
   Edit switches rule + category to inline inputs; evidence is read-only. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, IconBtn, ProgressBar, TextInput } from "@devdigest/ui";
import type { Convention, ConventionStatus } from "@/lib/hooks/conventions";
import { confidenceColor, evidenceRef } from "../../../../helpers";
import { s } from "./styles";

const RULE_MIN = 3;

export interface ConventionCardProps {
  convention: Convention;
  onStatus: (status: ConventionStatus) => void;
  onEdit: (patch: { rule: string; category: string }) => void;
  busy?: boolean;
}

export function ConventionCard({ convention: c, onStatus, onEdit, busy }: ConventionCardProps) {
  const t = useTranslations("conventions.card");
  const [editing, setEditing] = React.useState(false);
  const [rule, setRule] = React.useState(c.rule);
  const [category, setCategory] = React.useState(c.category);

  const startEdit = () => {
    setRule(c.rule);
    setCategory(c.category);
    setEditing(true);
  };
  const ruleTooShort = rule.trim().length < RULE_MIN;
  const save = () => {
    if (ruleTooShort) return;
    onEdit({ rule: rule.trim(), category: category.trim() || c.category });
    setEditing(false);
  };

  const toggle = (target: ConventionStatus) => onStatus(c.status === target ? "pending" : target);
  const pct = Math.round(c.confidence * 100);
  const lines = c.evidence_snippet.split("\n");

  return (
    <article style={s.card(c.status)} aria-label={c.rule}>
      <div style={s.main}>
        {editing ? (
          <>
            <div style={s.editGrid}>
              <TextInput value={rule} onChange={setRule} aria-label={t("ruleLabel")} />
              <TextInput value={category} onChange={setCategory} aria-label={t("categoryLabel")} mono />
            </div>
            {ruleTooShort && (
              <div role="alert" style={s.error}>
                {t("ruleTooShort")}
              </div>
            )}
            <div style={s.editActions}>
              <Button size="sm" kind="primary" icon="Check" onClick={save} disabled={ruleTooShort}>
                {t("save")}
              </Button>
              <Button size="sm" kind="ghost" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </div>
          </>
        ) : (
          <div style={s.titleRow}>
            <h3 style={s.rule}>{c.rule}</h3>
            <Badge mono icon="Tag">
              {c.category}
            </Badge>
            <IconBtn icon="Edit" label={t("edit")} size={26} onClick={startEdit} />
          </div>
        )}

        <div style={s.evidence}>
          <div style={s.evidenceHeader}>
            <span className="mono">{evidenceRef(c)}</span>
            <IconBtn
              icon="Copy"
              label={t("copy")}
              size={24}
              onClick={() => void navigator.clipboard?.writeText(c.evidence_snippet)}
            />
          </div>
          <pre className="mono" style={s.snippet}>
            {lines.map((line, i) => (
              <div key={i}>
                <span style={s.lineNo}>{c.evidence_line_start + i}</span>
                {line}
              </div>
            ))}
          </pre>
        </div>

        <div style={s.confidenceRow}>
          {t("confidence")}
          <div style={s.bar}>
            <ProgressBar value={pct} color={confidenceColor(c.confidence)} height={5} />
          </div>
          <span className="mono">{pct}%</span>
        </div>
      </div>

      <div style={s.actions}>
        <Button
          kind={c.status === "accepted" ? "primary" : "secondary"}
          icon="Check"
          full
          aria-pressed={c.status === "accepted"}
          disabled={busy}
          onClick={() => toggle("accepted")}
        >
          {c.status === "accepted" ? t("accepted") : t("accept")}
        </Button>
        <Button
          kind={c.status === "rejected" ? "danger" : "ghost"}
          icon="X"
          full
          aria-pressed={c.status === "rejected"}
          disabled={busy}
          onClick={() => toggle("rejected")}
        >
          {c.status === "rejected" ? t("rejected") : t("reject")}
        </Button>
      </div>
    </article>
  );
}
