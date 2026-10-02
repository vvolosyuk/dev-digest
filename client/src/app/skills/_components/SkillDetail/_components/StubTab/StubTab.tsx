/* StubTab — placeholder for tabs delivered in later lessons (Context L05,
   Evals L06, Stats L07). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, type IconName } from "@devdigest/ui";
import { TabHeader } from "../TabHeader";

export function StubTab({ title, lesson, icon }: { title: string; lesson: string; icon?: IconName }) {
  const t = useTranslations("skills");
  return (
    <div>
      <TabHeader title={title} />
      <EmptyState icon={icon ?? "Clock"} title={t("stub.title", { lesson })} body={t("stub.body")} />
    </div>
  );
}
