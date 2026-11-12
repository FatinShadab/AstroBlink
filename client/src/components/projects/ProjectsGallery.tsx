"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Field";
import { Badge, Card, ProgressBar } from "@/components/ui/Surfaces";
import { PROJECTS, type ProjectDef } from "@/data/projects";
import { FREE_EXPLORE_IMAGE, PROJECT_IMAGES } from "@/data/projectImages";
import { ProjectImageView } from "./ProjectImageView";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { progressFor } from "@/lib/projects/progress";
import { useUserStore } from "@/lib/state/useUserStore";

type Filter = "all" | ProjectDef["difficulty"];
const FILTERS: Filter[] = ["all", "beginner", "intermediate", "advanced"];

/** Project gallery (design §8.3): filter chips, a card per project, and a free-explore card. */
export function ProjectsGallery() {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const classifications = useUserStore((s) => s.classifications);
  const trainingDone = useUserStore((s) => s.trainingDone);
  const visible = PROJECTS.filter((p) => filter === "all" || p.difficulty === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-semibold text-text-primary">
          {t("projects.title")}
        </h1>
        <p className="text-body-lg text-text-secondary">{t("projects.intro")}</p>
      </div>

      <div role="group" aria-label={t("projects.filter")} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            {t(`projects.filter.${f}` as DictKey)}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((project) => {
          const done = progressFor(classifications, project.slug, project.fieldCount);
          const trained = trainingDone[project.slug] === true;
          return (
            <Card key={project.slug} className="flex flex-col gap-3">
              {PROJECT_IMAGES[project.slug] && (
                <ProjectImageView image={PROJECT_IMAGES[project.slug]} aspect="wide" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    project.difficulty === "beginner"
                      ? "success"
                      : project.difficulty === "intermediate"
                        ? "warning"
                        : "primary"
                  }
                >
                  {t(`projects.filter.${project.difficulty}` as DictKey)}
                </Badge>
              </div>
              <h2 className="font-display text-h3 font-medium text-text-primary">
                <Link href={`/projects/${project.slug}`} className="hover:underline">
                  {t(project.titleKey)}
                </Link>
              </h2>
              <p className="text-body-sm text-text-secondary">{t(project.descriptionKey)}</p>
              <p className="text-caption text-text-muted">
                ◎ {t(project.questionKey)} · {project.fieldCount} {t("projects.fields")}
              </p>
              {done.count > 0 && (
                <ProgressBar
                  label={t("projects.yourProgress")}
                  value={done.count}
                  max={project.fieldCount}
                />
              )}
              <div className="mt-auto pt-2">
                <Link
                  href={
                    trained
                      ? `/projects/${project.slug}/classify`
                      : `/projects/${project.slug}/train`
                  }
                  className="inline-flex min-h-11 items-center gap-1 font-medium text-accent underline-offset-4 hover:underline focus-visible:rounded-sm"
                >
                  {done.count > 0 ? t("projects.continue") : t("projects.start")} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </Card>
          );
        })}

        <Card className="flex flex-col gap-3">
          <ProjectImageView image={FREE_EXPLORE_IMAGE} aspect="wide" />
          <h2 className="font-display text-h3 font-medium text-text-primary">
            {t("projects.free")}
          </h2>
          <p className="text-body-sm text-text-secondary">{t("projects.freeBody")}</p>
          <div className="mt-auto pt-2">
            <Link href="/explore" className={buttonStyles({ variant: "secondary" })}>
              {t("projects.freeCta")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
