"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useLang, useT } from "@/lib/i18n/LangProvider";
import type { Lang } from "@/lib/i18n/lang";

const options = [
  { value: "en", label: "EN" },
  { value: "bn", label: "বাং" },
] as const satisfies readonly { value: Lang; label: string }[];

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const { t } = useT();
  return (
    <SegmentedControl<Lang>
      label={t("header.language")}
      options={options}
      value={lang}
      onChange={setLang}
      className={className}
    />
  );
}
