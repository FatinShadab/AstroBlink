"use client";

import { useT } from "@/lib/i18n/LangProvider";

/** Visible only on keyboard focus; jumps past the header (WCAG 2.4.1). */
export function SkipLink() {
  const { t } = useT();
  return (
    <a
      href="#main"
      className="fixed top-2 left-2 z-[70] -translate-y-16 rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-transform focus:translate-y-0"
    >
      {t("nav.skip")}
    </a>
  );
}
