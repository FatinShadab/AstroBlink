"use client";

import { useT } from "@/lib/i18n/LangProvider";

export function HomeIntro() {
  const { t } = useT();
  return <p className="max-w-[68ch] text-body-lg text-text-secondary">{t("home.placeholder")}</p>;
}
