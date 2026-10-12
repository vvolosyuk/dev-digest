/* Conventions extractor — /repos/:repoId/conventions (L02). Thin route:
   resolves the repo and renders ConventionsView inside the app shell. */
"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ConventionsView } from "./_components/ConventionsView";

export default function ConventionsPage() {
  const t = useTranslations("conventions.page");
  const { repoId } = useParams<{ repoId: string }>();
  const { repos } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const repoFullName = repos?.find((r) => r.id === repoId)?.full_name ?? t("repoFallback");
  const crumb = [{ label: t("crumbLab") }, { label: t("crumbConventions") }];

  return (
    <AppShell crumb={crumb}>
      {repoNotFound ? <RepoNotFound /> : <ConventionsView repoId={repoId} repoFullName={repoFullName} />}
    </AppShell>
  );
}
