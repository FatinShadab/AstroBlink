"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Radix";
import { Badge, Card, KpiTile } from "@/components/ui/Surfaces";
import { DemoDataBadge } from "@/components/ui/DemoBadge";
import { PROJECTS, ANSWER_LABEL } from "@/data/projects";
import { formatDate, fill } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { myStats } from "@/lib/stats/selectors";
import { useUserStore } from "@/lib/state/useUserStore";

const ActivityChart = dynamic(() => import("./Charts").then((m) => m.ActivityChart), {
  ssr: false,
  loading: () => <div className="h-56" />,
});
const ProjectBars = dynamic(() => import("./Charts").then((m) => m.ProjectBars), {
  ssr: false,
  loading: () => <div className="h-64" />,
});

/** My stats (design §8.8). Every number is computed from this browser's classifications. */
export function StatsView() {
  const { t, lang } = useT();
  const user = useUserStore((s) => s.user);
  const classifications = useUserStore((s) => s.classifications);
  const clearMyData = useUserStore((s) => s.clearMyData);
  const stats = myStats(classifications);
  const [confirming, setConfirming] = useState(false);
  const since = classifications[0]?.createdAt;
  const name = user?.name ?? t("me.guest");
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const projectData = PROJECTS.map((p) => ({
    name: t(p.titleKey),
    value: stats.byProject[p.slug] ?? 0,
  })).filter((row) => row.value > 0);

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-wrap items-center gap-6">
        <div
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-subtle font-display text-h4 font-semibold text-primary"
        >
          {initials || "?"}
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <h1 className="font-display text-h2 font-semibold text-text-primary">{name}</h1>
          <p className="text-caption text-text-muted">
            {since
              ? fill(t("me.since"), { date: formatDate(since.slice(0, 10), lang) })
              : t("me.notStarted")}
          </p>
          {!user && <p className="text-body-sm text-text-secondary">{t("me.localNote")}</p>}
        </div>
        <Link href="/me/certificate" className={buttonStyles({ variant: "primary" })}>
          {t("me.certificate")}
        </Link>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile label={t("me.kpi.checked")} value={stats.fieldsChecked} />
        <KpiTile label={t("me.kpi.projects")} value={stats.projectsJoined} />
        <KpiTile label={t("me.kpi.flagged")} value={stats.flagged} />
        <Card className="flex min-h-[120px] flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption font-medium text-text-secondary">{t("me.kpi.agreement")}</p>
            <DemoDataBadge />
          </div>
          <p className="font-display text-[2rem] leading-10 font-semibold tabular-nums text-text-primary">
            {stats.agreementRate === null ? "–" : `${Math.round(stats.agreementRate * 100)}%`}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <Card className="flex flex-col gap-3 md:col-span-8">
          <h2 className="font-sans text-h4 font-medium text-text-primary">{t("me.activity")}</h2>
          <ActivityChart data={stats.perDay} label={t("me.activity")} />
        </Card>
        <Card className="flex flex-col gap-3 md:col-span-4">
          <h2 className="font-sans text-h4 font-medium text-text-primary">{t("me.byProject")}</h2>
          {projectData.length > 0 ? (
            <ProjectBars data={projectData} label={t("me.byProject")} />
          ) : (
            <p className="text-body-sm text-text-muted">{t("me.noProjects")}</p>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-sans text-h4 font-medium text-text-primary">{t("me.recent")}</h2>
        {stats.recent.length === 0 ? (
          <p className="text-body-sm text-text-muted">{t("me.noActivity")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("me.table.date")}</th>
                  <th className="py-2 pr-4 font-medium">{t("me.table.project")}</th>
                  <th className="py-2 pr-4 font-medium">{t("me.table.answer")}</th>
                  <th className="py-2 font-medium">{t("me.table.agreement")}</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {stats.recent.map((c) => {
                  const project = PROJECTS.find((p) => p.slug === c.projectSlug);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2 pr-4 tabular-nums">
                        {formatDate(c.createdAt.slice(0, 10), lang)}
                      </td>
                      <td className="py-2 pr-4">{project ? t(project.titleKey) : c.projectSlug}</td>
                      <td className="py-2 pr-4">{t(ANSWER_LABEL[c.answer] as DictKey)}</td>
                      <td className="py-2">
                        {c.agrees === undefined ? (
                          "–"
                        ) : (
                          <Badge tone={c.agrees ? "success" : "neutral"}>
                            {c.agrees ? t("me.agrees") : t("me.differs")}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-caption text-text-muted">{t("me.demoNote")}</p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogTrigger asChild>
            <Button variant="secondary">{t("me.clear")}</Button>
          </DialogTrigger>
          <DialogContent
            title={t("me.clearTitle")}
            description={t("me.clearBody")}
            closeLabel={t("common.close")}
          >
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t("common.close")}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  clearMyData();
                  setConfirming(false);
                }}
              >
                {t("me.clearConfirm")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
