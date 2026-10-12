/* SkillBodyEditor — mono Markdown editor with a `<name>.md` header, an
   "unsaved" badge, an approximate token counter and a line-number gutter.
   A native <textarea> is used (not the vendored Textarea) because the gutter
   needs `wrap="off"` and a scroll handler to stay aligned with the lines. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { estimateTokens, lineCount } from "./helpers";
import { s } from "./styles";

export function SkillBodyEditor({
  value,
  onChange,
  fileName,
  unsaved,
  invalid,
  rows = 18,
}: {
  value: string;
  onChange: (v: string) => void;
  fileName: string;
  unsaved?: boolean;
  invalid?: boolean;
  rows?: number;
}) {
  const t = useTranslations("skills");
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lines = lineCount(value);

  // Keep the gutter scrolled in lock-step with the textarea.
  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  return (
    <div style={s.wrap(!!invalid)}>
      <div style={s.header}>
        <Icon.FileText size={13} style={s.headerIcon} />
        <span className="mono" style={s.fileName}>
          {(fileName || t("editor.untitled")) + ".md"}
        </span>
        {unsaved && (
          <Badge color="var(--warn)" bg="var(--warn-bg)">
            {t("editor.unsaved")}
          </Badge>
        )}
        <span className="tnum" style={s.tokens} title={t("editor.tokensHint")}>
          {t("editor.tokens", { count: estimateTokens(value) })}
        </span>
      </div>
      <div style={s.body}>
        <div ref={gutterRef} aria-hidden="true" className="mono" style={s.gutter}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          className="mono"
          aria-label={t("editor.bodyAria")}
          aria-invalid={invalid || undefined}
          value={value}
          rows={rows}
          wrap="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
