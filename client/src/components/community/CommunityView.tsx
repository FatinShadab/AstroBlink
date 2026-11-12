"use client";

import dynamic from "next/dynamic";
import { DemoDataBadge } from "@/components/ui/DemoBadge";
import { Card, KpiTile, Skeleton } from "@/components/ui/Surfaces";
import { PROJECTS } from "@/data/projects";
import { useCommunity } from "@/lib/demo/useCommunity";
import { formatMonthYear } from "@/lib/i18n/format";
import { useLang, useT } from "@/lib/i18n/LangProvider";

const MonthlyChart = dynamic(
  () => import("@/components/stats/Charts").then((m) => m.MonthlyChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);
const ProjectBars = dynamic(() => import("@/components/stats/Charts").then((m) => m.ProjectBars), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

/** Community (design §8.9): demo totals and charts, always labelled. There is no leaderboard (rules §2.8). */
export function CommunityView() {
  const { t } = useT();
  const { lang } = useLang();
  const data = useCommunity();

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const monthly = data.monthly.map((m) => ({
    month: formatMonthYear(`${m.month}-01`, lang),
    classifications: m.classifications,
  }));
  const byProject = data.byProject.map((row) => ({
    name: t(PROJECTS.find((p) => p.slug === row.slug)?.titleKey ?? "common.loading"),
    value: row.classifications,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-h1 font-semibold text-text-primary">
          {t("community.title")}
        </h1>
        <DemoDataBadge />
      </div>
      <p className="max-w-[68ch] text-body-lg text-text-secondary">{t("community.intro")}</p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile
          label={t("community.kpi.volunteers")}
          value={data.totals.volunteers.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
        />
        <KpiTile
          label={t("community.kpi.classifications")}
          value={data.totals.classifications.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
        />
        <KpiTile
          label={t("community.kpi.flagged")}
          value={data.totals.flagged.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
        />
        <KpiTile
          label={t("community.kpi.agreement")}
          value={`${Math.round(data.totals.agreementRate * 100)}%`}
        />
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-sans text-h4 font-medium text-text-primary">
          {t("community.overTime")}
        </h2>
        <MonthlyChart data={monthly} label={t("community.overTime")} />
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="font-sans text-h4 font-medium text-text-primary">
            {t("community.byProject")}
          </h2>
          <ProjectBars data={byProject} label={t("community.byProject")} />
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-sans text-h4 font-medium text-text-primary">
            {t("community.volunteers")}
          </h2>
          <MonthlyChart
            data={data.monthly.map((m) => ({
              month: formatMonthYear(`${m.month}-01`, lang),
              classifications: m.volunteers,
            }))}
            label={t("community.volunteers")}
          />
        </Card>
      </div>
      <p className="text-caption text-text-muted">{t("community.demoNote")}</p>
    </div>
  );
}
