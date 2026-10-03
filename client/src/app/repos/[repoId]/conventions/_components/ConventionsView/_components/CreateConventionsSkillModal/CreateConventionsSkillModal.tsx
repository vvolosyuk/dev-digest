/* CreateConventionsSkillModal — merge the accepted conventions into ONE skill.
   On open the server drafts the description + body (LLM prose in the
   docs/skills-samples format; evidence inserted from the verified rows; a
   template when the model is unavailable). Everything stays editable and
   nothing is persisted until "Create skill". If the name is taken, the user
   is asked to save it as a new version of that skill or discard. The new skill is
   `source: extracted` and is NOT linked to any agent (done in the agent editor). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Icon, Modal, SelectInput, Skeleton, TextInput, Toggle } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import {
  useCreateSkillFromConventions,
  useConventionsSkillDraft,
  type Convention,
  type ConventionsSkillDraft,
  type SkillNameConflict,
} from "@/lib/hooks/conventions";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { SkillBodyEditor } from "@/app/skills/_components/SkillBodyEditor";
import { SKILL_TYPES } from "@/app/skills/constants";
import { hasErrors, validateSkillForm } from "@/app/skills/helpers";
import { defaultSkillName, renameBodyHeading, shortRepoName } from "../../../../helpers";
import { s } from "./styles";

const MODAL_WIDTH = 760;
const BODY_ROWS = 14;
const BODY_SKELETON_HEIGHT = 280;

interface DraftForm {
  name: string;
  description: string;
  type: SkillType;
  enabled: boolean;
  body: string;
}

export interface CreateConventionsSkillModalProps {
  repoId: string;
  /** `owner/name`. */
  repoFullName: string;
  accepted: readonly Convention[];
  onClose: () => void;
  onCreated: (skill: Skill) => void;
}

export function CreateConventionsSkillModal({
  repoId,
  repoFullName,
  accepted,
  onClose,
  onCreated,
}: CreateConventionsSkillModalProps) {
  const t = useTranslations("conventions.modal");
  const ts = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkillFromConventions(repoId);
  const repo = shortRepoName(repoFullName);

  const [form, setForm] = React.useState<DraftForm>(() => ({
    name: defaultSkillName(repoFullName),
    description: "",
    type: "convention",
    enabled: true,
    body: "",
  }));
  const [drafted, setDrafted] = React.useState<ConventionsSkillDraft | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  /** Set by a 409: the name is taken by an existing skill at `version`. */
  const [conflict, setConflict] = React.useState<{ name: string; version: number } | null>(null);

  const ids = React.useMemo(() => accepted.map((c) => c.id), [accepted]);
  // The draft is requested with the name at open time (stable query key);
  // later renames retitle the body client-side via renameBodyHeading.
  const [draftName] = React.useState(() => defaultSkillName(repoFullName));
  const draft = useConventionsSkillDraft(repoId, ids, draftName);

  // Each (re)fetched draft replaces description + body, retitled to the current name.
  React.useEffect(() => {
    const d = draft.data;
    if (!d) return;
    setDrafted(d);
    setForm((f) => ({ ...f, description: d.description, body: renameBodyHeading(d.body, draftName, f.name) }));
  }, [draft.data, draft.dataUpdatedAt, draftName]);

  const edited =
    drafted !== null &&
    (form.description !== drafted.description ||
      form.body !== renameBodyHeading(drafted.body, draftName, form.name));
  const regenerate = () => {
    if (edited && !window.confirm(t("regenerateConfirm"))) return;
    void draft.refetch();
  };

  const set = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setName = (name: string) =>
    setForm((f) => ({ ...f, name, body: renameBodyHeading(f.body, f.name, name) }));
  const values = { name: form.name.trim(), description: form.description.trim(), body: form.body };
  const errors = validateSkillForm(values);
  const nameError = attempted && errors.name ? ts(`config.errors.${errors.name}`) : undefined;
  const descriptionError =
    attempted && errors.description ? ts(`config.errors.${errors.description}`) : undefined;
  const bodyError = attempted && errors.body ? ts(`config.errors.${errors.body}`) : undefined;
  // Ask only while the name still matches the one the server rejected.
  const activeConflict = conflict !== null && conflict.name === values.name ? conflict : null;

  /** `new_version`: the user confirmed saving over the existing same-named skill. */
  const save = (onConflict: "fail" | "new_version" = "fail") => {
    setAttempted(true);
    if (hasErrors(errors)) return;
    create.mutate(
      { ...values, type: form.type, enabled: form.enabled, convention_ids: ids, on_conflict: onConflict },
      {
        onSuccess: (skill) => {
          toast.success(
            onConflict === "new_version"
              ? t("versionToast", { name: skill.name, version: skill.version })
              : t("createdToast", { name: skill.name }),
          );
          onCreated(skill);
        },
        onError: (e) => {
          const details = e instanceof ApiError && e.status === 409 ? (e.details as SkillNameConflict | undefined) : undefined;
          if (details?.version) setConflict({ name: values.name, version: details.version });
          else toast.error(e instanceof Error ? e.message : String(e));
        },
      },
    );
  };

  const drafting = draft.isFetching; // initial load and Regenerate
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: ts(`config.typeOption.${v}`) }));
  const fieldError = (msg?: string) =>
    msg && (
      <span role="alert" style={s.error}>
        {msg}
      </span>
    );

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("title")}
      subtitle={<span className="mono">{values.name || "—"}</span>}
      onClose={onClose}
      footer={
        activeConflict ? (
          <div role="alertdialog" aria-label={t("conflictTitle", activeConflict)} style={s.conflict}>
            <div style={s.spacer}>
              <div style={s.conflictTitle}>{t("conflictTitle", activeConflict)}</div>
              <div style={s.conflictBody}>{t("conflictBody", { next: activeConflict.version + 1 })}</div>
            </div>
            <Button kind="ghost" onClick={onClose} disabled={create.isPending}>
              {t("discard")}
            </Button>
            <Button
              kind="primary"
              icon="GitCommit"
              onClick={() => save("new_version")}
              loading={create.isPending}
            >
              {create.isPending ? t("savingVersion") : t("saveAsVersion", { next: activeConflict.version + 1 })}
            </Button>
          </div>
        ) : (
          <div style={s.footer}>
            <span style={s.footerNote}>{t("footerNote")}</span>
            <div style={s.spacer} />
            <Button kind="ghost" onClick={onClose} disabled={create.isPending}>
              {t("cancel")}
            </Button>
            <Button
              kind="primary"
              icon="Sparkles"
              onClick={() => save()}
              loading={create.isPending}
              disabled={drafting}
            >
              {create.isPending ? t("creating") : t("create")}
            </Button>
          </div>
        )
      }
    >
      <div style={s.body}>
        <div style={s.banner}>
          <Icon.Edit size={14} style={s.bannerIcon} />
          <span style={s.spacer}>{t("banner", { count: accepted.length, repo })}</span>
          <Button size="sm" kind="ghost" icon="RefreshCw" onClick={regenerate} loading={drafting}>
            {t("regenerate")}
          </Button>
        </div>

        {drafting ? (
          <div role="status" style={s.note}>
            {t("drafting")}
          </div>
        ) : draft.isError ? (
          <div role="alert" style={s.warn}>
            {t("draftFailed", { reason: draft.error.message })}
          </div>
        ) : drafted?.generated_by === "template" ? (
          <div role="alert" style={s.warn}>
            {t("templateFallback", { reason: drafted.warning ?? "—" })}
          </div>
        ) : drafted?.model ? (
          <div style={s.note}>{t("draftedWith", { model: drafted.model })}</div>
        ) : null}

        <FormField label={ts("config.name")} required hint={fieldError(nameError)}>
          <TextInput
            value={form.name}
            onChange={setName}
            aria-label={ts("config.name")}
            aria-invalid={!!nameError || undefined}
            mono
          />
        </FormField>

        <FormField
          label={ts("config.description")}
          hint={fieldError(descriptionError) || ts("config.descriptionHint")}
        >
          {drafting ? (
            <Skeleton height={38} />
          ) : (
            <TextInput
              value={form.description}
              onChange={(v) => set("description", v)}
              aria-label={ts("config.description")}
              aria-invalid={!!descriptionError || undefined}
            />
          )}
        </FormField>

        <div style={s.row}>
          <FormField label={ts("config.type")}>
            <SelectInput
              value={form.type}
              onChange={(v) => set("type", v as SkillType)}
              options={typeOptions}
              mono={false}
            />
          </FormField>
          <FormField label={ts("config.enabled")} hint={t("enabledHint")}>
            <div style={s.enabledRow}>
              <Toggle on={form.enabled} onChange={(v) => set("enabled", v)} />
            </div>
          </FormField>
        </div>

        <FormField label={ts("config.body")} required hint={fieldError(bodyError)}>
          {drafting ? (
            <Skeleton height={BODY_SKELETON_HEIGHT} />
          ) : (
            <SkillBodyEditor
              value={form.body}
              onChange={(v) => set("body", v)}
              fileName={values.name}
              unsaved
              invalid={!!bodyError}
              rows={BODY_ROWS}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
