"use client";

import { Card } from "@/components/ui/Surfaces";
import { TEAM, TEAM_NAME } from "@/data/team";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";

const SECTIONS = ["what", "spherex", "blink", "data", "credits", "team"] as const;

/** About (design §8.11): honest about the data, with the required credits and the team. */
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
          {key === "team" && (
            <div className="flex flex-col gap-3">
              <p className="font-display text-h4 font-semibold text-text-primary">{TEAM_NAME}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {TEAM.map((member) => (
                  <li
                    key={member.name}
                    className="rounded-[var(--radius-md)] border border-border bg-surface-1 px-4 py-3"
                  >
                    <p className="text-body font-medium text-text-primary">{member.name}</p>
                    <p className="text-body-sm text-text-secondary">
                      {member.roles.map((role) => t(role)).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
      {/* The general NASA credit is in the Credits section and the site footer, so it is not repeated here. */}
      <Card className="flex flex-col gap-2 text-caption text-text-muted">
        <p>
          {t("data.credit")} {t("data.tools")}
        </p>
        <p>{t("data.refresh")}</p>
        <p>{t("about.models")}</p>
        <p>{t("about.loginImage")}</p>
      </Card>
    </article>
  );
}
