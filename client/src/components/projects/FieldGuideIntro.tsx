"use client";

import { useT } from "@/lib/i18n/LangProvider";

export function FieldGuideIntro() {
  const { t } = useT();
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-display text-h1 font-semibold text-text-primary">{t("guide.title")}</h1>
      <p className="max-w-[68ch] text-body-lg text-text-secondary">{t("guide.intro")}</p>
    </header>
  );
}
