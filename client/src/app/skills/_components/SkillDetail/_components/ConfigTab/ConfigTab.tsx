/* ConfigTab — create/edit form for a skill: name, description, type,
   enabled and body (SkillBodyEditor). In edit mode Save opens the
   SaveVersionModal to title the new version; with no `skill` it runs in
   create mode. Reports its dirty state upward so the page
   can guard against losing unsaved edits. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, SelectInput, TextInput, Toggle } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useCreateSkill, useUpdateSkill } from "../../../../../../lib/hooks/skills";
import { ApiError } from "../../../../../../lib/api";
import { useToast } from "../../../../../../lib/toast";
import { SKILL_TYPES } from "../../../../constants";
import { hasErrors, validateSkillForm } from "../../../../helpers";
import { SkillBodyEditor } from "../../../SkillBodyEditor";
import { SaveVersionModal } from "../../../SaveVersionModal";
import { TabHeader } from "../TabHeader";
import { diffPatch, formFromSkill, isDirty, normalizeForm, type ConfigForm } from "./helpers";
import { s } from "./styles";

/** Helper text plus an optional inline validation error under a field. */
function FieldHint({ hint, error }: { hint?: string; error?: string }) {
  return (
    <>
      {hint}
      {error && (
        <span role="alert" style={s.error}>
          {error}
        </span>
      )}
    </>
  );
}

export function ConfigTab({
  skill,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  /** Omit for create mode. */
  skill?: Skill;
  onSaved?: (skill: Skill) => void;
  /** Create mode only: leave the form. */
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();
  const update = useUpdateSkill();

  const initial = formFromSkill(skill);
  const [form, setForm] = React.useState<ConfigForm>(initial);
  // Edit mode: Save opens the SaveVersionModal (name the version + review the diff).
  const [confirming, setConfirming] = React.useState(false);
  const [createEnabled, setCreateEnabled] = React.useState(true);
  const [attempted, setAttempted] = React.useState(false);
  const [takenName, setTakenName] = React.useState<string | null>(null);

  const dirty = isDirty(initial, form);
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // Leaving the form (tab switch / unmount) drops its unsaved state.
  React.useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const errors = validateSkillForm(normalizeForm(form));
  const show = (k: keyof ConfigForm) => attempted || form[k] !== initial[k];
  const nameError =
    takenName !== null && form.name.trim() === takenName
      ? t("config.errors.nameTaken")
      : errors.name && show("name")
        ? t(`config.errors.${errors.name}`)
        : undefined;
  const descriptionError =
    errors.description && show("description") ? t(`config.errors.${errors.description}`) : undefined;
  const bodyError = errors.body && show("body") ? t(`config.errors.${errors.body}`) : undefined;

  const set = <K extends keyof ConfigForm>(k: K, v: ConfigForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`config.typeOption.${v}`) }));
  const pending = create.isPending || update.isPending;
  const saveLabel = skill
    ? t(pending ? "config.saving" : "config.save")
    : t(pending ? "config.creating" : "config.create");

  const onConflict = (e: unknown, name: string) => {
    if (e instanceof ApiError && e.status === 409) setTakenName(name);
  };

  const save = () => {
    setAttempted(true);
    if (hasErrors(errors)) return;
    const values = normalizeForm(form);
    if (!skill) {
      create.mutate(
        { ...values, enabled: createEnabled, source: "manual" },
        {
          onSuccess: (created) => {
            toast.success(t("config.createdToast", { name: created.name }));
            onSaved?.(created);
          },
          onError: (e) => onConflict(e, values.name),
        },
      );
      return;
    }
    if (Object.keys(diffPatch(initial, values, "")).length === 0) return;
    setConfirming(true);
  };

  const saveVersion = (title: string) => {
    if (!skill) return;
    const values = normalizeForm(form);
    update.mutate(
      { id: skill.id, patch: diffPatch(initial, values, title) },
      {
        onSuccess: (saved) => {
          setConfirming(false);
          setForm(formFromSkill(saved));
          setAttempted(false);
          toast.success(t("config.savedToast", { name: saved.name, version: saved.version }));
          onSaved?.(saved);
        },
        onError: (e) => {
          setConfirming(false);
          onConflict(e, values.name);
        },
      },
    );
  };

  const cancel = () => {
    if (!skill) return onCancel?.();
    setForm(initial);
    setAttempted(false);
    setTakenName(null);
  };

  // Enabled is not versioned: in edit mode it applies immediately.
  const enabled = skill ? skill.enabled : createEnabled;
  const toggleEnabled = (v: boolean) =>
    skill ? update.mutate({ id: skill.id, patch: { enabled: v } }) : setCreateEnabled(v);

  return (
    <div style={s.wrap}>
      <TabHeader
        title={t("config.title")}
        badge={
          skill && (
            <Badge icon="GitCommit" mono>
              v{skill.version}
            </Badge>
          )
        }
        right={
          <label style={s.enabledLabel}>
            {t("config.enabled")}
            <Toggle on={enabled} onChange={toggleEnabled} size={16} />
          </label>
        }
      />

      <FormField
        label={t("config.name")}
        required
        hint={<FieldHint hint={t("config.nameHint")} error={nameError} />}
      >
        <TextInput
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder={t("config.namePlaceholder")}
          aria-label={t("config.name")}
          aria-invalid={!!nameError || undefined}
          mono
        />
      </FormField>

      <FormField
        label={t("config.description")}
        hint={<FieldHint hint={t("config.descriptionHint")} error={descriptionError} />}
      >
        <TextInput
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder={t("config.descriptionPlaceholder")}
          aria-label={t("config.description")}
          aria-invalid={!!descriptionError || undefined}
        />
      </FormField>

      <FormField label={t("config.type")}>
        <SelectInput value={form.type} onChange={(v) => set("type", v as SkillType)} options={typeOptions} mono={false} />
      </FormField>

      <FormField
        label={t("config.body")}
        required
        hint={bodyError && <FieldHint error={bodyError} />}
      >
        <SkillBodyEditor
          value={form.body}
          onChange={(v) => set("body", v)}
          fileName={form.name.trim()}
          unsaved={dirty}
          invalid={!!bodyError}
        />
      </FormField>

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={pending || (!!skill && !dirty)}>
          {saveLabel}
        </Button>
        <Button kind="ghost" onClick={cancel} disabled={pending || (!!skill && !dirty)}>
          {t("config.cancel")}
        </Button>
      </div>

      {skill && confirming && (
        <SaveVersionModal
          currentVersion={skill.version}
          before={initial}
          after={normalizeForm(form)}
          pending={update.isPending}
          onConfirm={saveVersion}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
