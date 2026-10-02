/* ImportSkillModal — two-step import: (1) pick a .md/.zip → server preview
   (persists nothing); (2) review the untrusted content, adjust name /
   description / type, and only an explicit "Save skill" creates it
   (`source: "imported_url"`). Cancel at any point saves nothing. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal } from "@devdigest/ui";
import type { Skill, SkillImportPreview } from "@devdigest/shared";
import { useCreateSkill, useImportSkillPreview } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { useToast } from "../../../../lib/toast";
import { hasErrors, validateSkillForm } from "../../helpers";
import { ImportPreview, type ImportForm } from "./_components/ImportPreview";
import { ACCEPT, MODAL_WIDTH } from "./constants";
import { readFileAsBase64 } from "./helpers";
import { s } from "./styles";

export function ImportSkillModal({ onClose, onSaved }: { onClose: () => void; onSaved: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const preview = useImportSkillPreview();
  const create = useCreateSkill();
  const [data, setData] = React.useState<SkillImportPreview | null>(null);
  const [form, setForm] = React.useState<ImportForm>({ name: "", description: "", type: "custom" });
  const [readError, setReadError] = React.useState<string | null>(null);
  const [takenName, setTakenName] = React.useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    let content_base64: string;
    try {
      content_base64 = await readFileAsBase64(file);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
      return;
    }
    preview.mutate(
      { filename: file.name, content_base64 },
      {
        onSuccess: (p) => {
          setData(p);
          setForm({ name: p.name, description: p.description, type: p.type });
          setTakenName(p.conflict ? p.name : null);
        },
      },
    );
  };

  const values = { name: form.name.trim(), description: form.description.trim(), body: data?.body ?? "" };
  const errors = validateSkillForm(values);
  const conflict = takenName !== null && values.name === takenName;

  const save = () => {
    if (!data || hasErrors(errors) || conflict) return;
    create.mutate(
      { ...values, type: form.type, source: "imported_url" },
      {
        onSuccess: (created) => {
          toast.success(t("import.savedToast", { name: created.name }));
          onSaved(created);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) setTakenName(values.name);
        },
      },
    );
  };

  const fileError = readError ?? (preview.error ? preview.error.message : null);

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {data && (
            <Button kind="tertiary" icon="ChevronLeft" onClick={() => setData(null)} disabled={create.isPending}>
              {t("import.back")}
            </Button>
          )}
          <div style={s.spacer} />
          <Button kind="ghost" onClick={onClose}>
            {t("import.cancel")}
          </Button>
          {data && (
            <Button
              kind="primary"
              icon="Check"
              onClick={save}
              disabled={hasErrors(errors) || conflict || create.isPending}
            >
              {create.isPending ? t("import.saving") : t("import.save")}
            </Button>
          )}
        </div>
      }
    >
      <div style={s.body}>
        {data ? (
          <ImportPreview
            preview={data}
            form={form}
            onForm={setForm}
            errors={errors}
            conflict={conflict}
          />
        ) : (
          <FormField label={t("import.chooseFile")} hint={t("import.fileHint")}>
            <input
              type="file"
              accept={ACCEPT}
              aria-label={t("import.chooseFile")}
              disabled={preview.isPending}
              onChange={(e) => onFile(e.target.files?.[0])}
              style={s.fileInput}
            />
            {preview.isPending && <div style={s.muted}>{t("import.parsing")}</div>}
            {fileError && (
              <div role="alert" style={s.error}>
                {t("import.failed")}: {fileError}
              </div>
            )}
          </FormField>
        )}
      </div>
    </Modal>
  );
}
