/* SkillsView — /skills and /skills/:id (L02). Left: SkillList; right: the
   selected skill's SkillDetail (tab in ?tab=), the create form at
   /skills/new, or an empty / select prompt. Guards unsaved Config edits when
   switching skills or tabs and when leaving the page. */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "../../../../components/app-shell";
import { useSkill, useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { SkillList } from "../SkillList";
import { SkillDetail, VALID_TABS } from "../SkillDetail";
import { ImportSkillModal } from "../ImportSkillModal";
import { DeleteSkillModal } from "../DeleteSkillModal";
import { NEW_SKILL_ID, SEARCH_DEBOUNCE_MS } from "./constants";
import { useBeforeUnloadGuard, useDebouncedValue } from "./hooks";
import { s } from "./styles";

export function SkillsView() {
  const t = useTranslations("skills");
  const params = useParams<{ id?: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const routeId = params?.id ?? null;
  const isNew = routeId === NEW_SKILL_ID;
  const selectedId = isNew ? null : routeId;
  const rawTab = search.get("tab") ?? "";
  const tab = VALID_TABS.includes(rawTab) ? rawTab : "config";

  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const list = useSkills(debouncedQuery);
  const detail = useSkill(selectedId);
  const update = useUpdateSkill();

  const [dirty, setDirty] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Skill | null>(null);
  useBeforeUnloadGuard(dirty);

  /** True when it's fine to drop the Config form (clean, or the user agreed). */
  const confirmDiscard = () => !dirty || window.confirm(t("page.unsavedConfirm"));

  const go = (href: string) => {
    if (!confirmDiscard()) return;
    setDirty(false);
    router.push(href);
  };
  const setTab = (next: string) => {
    if (next === tab || !selectedId || !confirmDiscard()) return;
    setDirty(false);
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${selectedId}?${sp.toString()}`);
  };
  const onSaved = (saved: Skill) => {
    if (saved.id === selectedId) return;
    setDirty(false);
    router.push(`/skills/${saved.id}?tab=config`);
  };

  const skill = detail.data;
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    ...(isNew ? [{ label: t("page.newSkill") }] : skill ? [{ label: skill.name, mono: true }] : []),
  ];
  const notFound = detail.error instanceof ApiError && detail.error.status === 404;
  const noSkillsAtAll =
    !list.isLoading && !list.isError && list.data?.length === 0 && !debouncedQuery.trim();

  let pane: React.ReactNode;
  if (isNew) {
    pane = (
      <SkillDetail
        tab="config"
        onTab={setTab}
        onSaved={onSaved}
        onCancelCreate={() => go("/skills")}
        onDirtyChange={setDirty}
      />
    );
  } else if (selectedId && detail.isLoading) {
    pane = (
      <div style={s.loading}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  } else if (selectedId && detail.isError && !notFound) {
    pane = (
      <ErrorState title={t("detail.loadError")} body={detail.error?.message} onRetry={() => detail.refetch()} />
    );
  } else if (selectedId && !skill) {
    pane = <EmptyState icon="Search" title={t("detail.notFound.title")} body={t("detail.notFound.body")} />;
  } else if (skill) {
    pane = (
      <SkillDetail
        skill={skill}
        tab={tab}
        onTab={setTab}
        onDelete={() => setDeleting(skill)}
        onSaved={onSaved}
        onCancelCreate={() => go("/skills")}
        onDirtyChange={setDirty}
      />
    );
  } else if (noSkillsAtAll) {
    pane = (
      <EmptyState
        icon="Sparkles"
        title={t("page.empty.title")}
        body={t("page.empty.body")}
        cta={t("page.empty.cta")}
        onCta={() => setImportOpen(true)}
      />
    );
  } else {
    pane = <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />;
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.layout}>
        <SkillList
          skills={list.data}
          isLoading={list.isLoading}
          isError={list.isError}
          activeId={selectedId}
          query={query}
          onQuery={setQuery}
          onSelect={(id) => id !== selectedId && go(`/skills/${id}?tab=${tab}`)}
          onToggle={(id, enabled) => update.mutate({ id, patch: { enabled } })}
          onCreate={() => go(`/skills/${NEW_SKILL_ID}`)}
          onImport={() => setImportOpen(true)}
        />
        <div style={s.pane}>{pane}</div>
      </div>
      {importOpen && (
        <ImportSkillModal
          onClose={() => setImportOpen(false)}
          onSaved={(created) => {
            setImportOpen(false);
            go(`/skills/${created.id}?tab=config`);
          }}
        />
      )}
      {deleting && (
        <DeleteSkillModal
          skill={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setDirty(false);
            router.push("/skills");
          }}
        />
      )}
    </AppShell>
  );
}
