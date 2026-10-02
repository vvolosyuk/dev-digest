/* ImportPreview — step 2 of the import: untrusted-content banner, editable
   name / description / type, the rendered body, ignored files and warnings. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, Icon, Markdown, SelectInput, TextInput } from "@devdigest/ui";
import type { SkillImportPreview, SkillType } from "@devdigest/shared";
import { SKILL_TYPES } from "../../../../constants";
import type { SkillFormErrors } from "../../../../helpers";
import { KNOWN_IGNORED_REASONS } from "../../constants";
import { s } from "./styles";

export interface ImportForm {
  name: string;
  description: string;
  type: SkillType;
}

export function ImportPreview({
  preview,
  form,
  onForm,
  errors,
  conflict,
}: {
  preview: SkillImportPreview;
  form: ImportForm;
  onForm: (f: ImportForm) => void;
  errors: SkillFormErrors;
  conflict: boolean;
}) {
  const t = useTranslations("skills");
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`config.typeOption.${v}`) }));
  const reasonLabel = (reason: string) =>
    (KNOWN_IGNORED_REASONS as readonly string[]).includes(reason) ? t(`import.reason.${reason}`) : reason;
  const nameError = conflict
    ? t("import.conflict")
    : errors.name
      ? t(`config.errors.${errors.name}`)
      : undefined;

  return (
    <div>
      <div role="note" style={s.banner}>
        <Icon.AlertTriangle size={16} style={s.bannerIcon} />
        <span>{t("preview.untrustedNotice")}</span>
      </div>

      <FormField
        label={t("import.name")}
        required
        hint={nameError && <span role="alert" style={s.error}>{nameError}</span>}
      >
        <TextInput
          value={form.name}
          onChange={(name) => onForm({ ...form, name })}
          aria-label={t("import.name")}
          aria-invalid={!!nameError || undefined}
          mono
        />
      </FormField>
      <FormField
        label={t("import.description")}
        hint={
          <>
            {t("config.descriptionHint")}
            {errors.description && (
              <span role="alert" style={s.error}>
                {t(`config.errors.${errors.description}`)}
              </span>
            )}
          </>
        }
      >
        <TextInput
          value={form.description}
          onChange={(description) => onForm({ ...form, description })}
          aria-label={t("import.description")}
        />
      </FormField>
      <FormField label={t("import.type")}>
        <SelectInput
          value={form.type}
          onChange={(v) => onForm({ ...form, type: v as SkillType })}
          options={typeOptions}
          mono={false}
        />
      </FormField>

      <FormField
        label={t("import.body")}
        hint={errors.body && <span role="alert" style={s.error}>{t(`config.errors.${errors.body}`)}</span>}
      >
        <div style={s.bodyBox}>
          <Markdown>{preview.body}</Markdown>
        </div>
      </FormField>

      {preview.ignored_files.length > 0 && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t("import.ignoredTitle")}</h3>
          <ul style={s.list}>
            {preview.ignored_files.map((f) => (
              <li key={f.path} style={s.item}>
                <Icon.Slash size={13} style={s.itemIcon} />
                <span className="mono" style={s.path}>
                  {f.path}
                </span>
                <span style={s.reason}>{reasonLabel(f.reason)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.warnings.length > 0 && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t("import.warningsTitle")}</h3>
          <ul style={s.list}>
            {preview.warnings.map((w) => (
              <li key={w} style={s.item}>
                <Icon.AlertTriangle size={13} style={s.warnIcon} />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
