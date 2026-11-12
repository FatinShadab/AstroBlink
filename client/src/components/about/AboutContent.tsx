"use client";

import { Card } from "@/components/ui/Surfaces";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";

const SECTIONS = ["what", "spherex", "blink", "data", "credits", "team"] as const;

/** About (design §8.11): honest about the data, with the required credits and a team placeholder. */
export function AboutContent() {
  const { t } = useT();
  return (
    <article className="flex flex-col gap-10">
      <h1 className="font-display text-h1 font-semibold text-text-primary">{t("about.title")}</h1>
      {SECTIONS.map((key) => (
        <section key={key} aria-labelledby={`about-${key}`} className="flex flex-col gap-3">
          <h2 id={`about-${key}`} className="font-display text-h2 font-semibold text-text-primary">
            {t(`about.${key}.title` as DictKey)}
          </h2>
          <p className="max-w-[68ch] text-body text-text-secondary">
            {t(`about.${key}.body` as DictKey)}
          </p>
        </section>
      ))}
      <Card className="flex flex-col gap-2 text-caption text-text-muted">
        <p>
          {t("data.credit")} {t("data.tools")}
        </p>
        <p>{t("data.refresh")}</p>
        <p>{t("footer.credit")}</p>
        <p>{t("about.models")}</p>
      </Card>
    </article>
  );
}
