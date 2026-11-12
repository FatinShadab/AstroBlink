"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Surfaces";
import type { ProjectDef } from "@/data/projects";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { useUserStore } from "@/lib/state/useUserStore";

const STEPS = ["project.step.practise", "project.step.look", "project.step.answer"] as const;
const LOOK_FOR = ["project.look.one", "project.look.two", "project.look.three"] as const;

/** Project overview (design §8.4): hero, the three steps, and what to look for. */
export function ProjectOverview({ project }: { project: ProjectDef }) {
  const { t } = useT();
  const trained = useUserStore((s) => s.trainingDone[project.slug] === true);
  const difficulty = t(`projects.filter.${project.difficulty}` as DictKey);

  return (
    <div className="flex flex-col gap-10">
      <Link href="/projects" className="self-start text-body-sm text-primary hover:underline">
        ← {t("projects.back")}
      </Link>

      <Card className="flex flex-col gap-4 rounded-[var(--radius-lg)] p-6 md:p-8">
        <Badge tone="primary" className="self-start">
          {difficulty}
        </Badge>
        <h1 className="font-display text-h1 font-semibold text-text-primary">
          {t(project.titleKey)}
        </h1>
        <p className="max-w-[68ch] text-body-lg text-text-secondary">{t(project.descriptionKey)}</p>
        <p className="text-caption text-text-muted">
          ◎ {t(project.questionKey)} · {project.fieldCount} {t("projects.fields")}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={`/projects/${project.slug}/train`}
            className={buttonStyles({ variant: "primary", size: "lg" })}
          >
            {t("project.startTraining")}
          </Link>
          {trained && (
            <Link
              href={`/projects/${project.slug}/classify`}
              className={buttonStyles({ variant: "tertiary", size: "lg" })}
            >
              {t("project.skipToClassify")}
            </Link>
          )}
        </div>
      </Card>

      <section aria-labelledby="steps" className="flex flex-col gap-4">
        <h2 id="steps" className="font-display text-h2 font-semibold text-text-primary">
          {t("project.stepsTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((key, i) => (
            <Card key={key} className="flex flex-col gap-2">
              <span className="font-mono text-caption text-text-muted">{i + 1}</span>
              <h3 className="font-sans text-h4 font-medium text-text-primary">
                {t(`${key}.title` as DictKey)}
              </h3>
              <p className="text-body-sm text-text-secondary">{t(`${key}.body` as DictKey)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="look" className="flex flex-col gap-4">
        <h2 id="look" className="font-display text-h2 font-semibold text-text-primary">
          {t("project.lookTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {LOOK_FOR.map((key) => (
            <Card key={key} className="flex flex-col gap-2">
              <h3 className="font-sans text-h4 font-medium text-text-primary">
                {t(`${key}.title` as DictKey)}
              </h3>
              <p className="text-body-sm text-text-secondary">{t(`${key}.body` as DictKey)}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
