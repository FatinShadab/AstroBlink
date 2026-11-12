"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Badge, Card, KpiTile } from "@/components/ui/Surfaces";
import { ContributionProgress } from "./ContributionProgress";
import { Chip } from "@/components/ui/Field";
import { ANSWER_LABEL, type ProjectDef } from "@/data/projects";
import { useT } from "@/lib/i18n/LangProvider";
import { fill } from "@/lib/i18n/format";
import type { DictKey } from "@/lib/i18n/en";
import type { Answer, QueueField } from "@/lib/data/types";
import { useProjectQueue } from "@/lib/projects/useProjectQueue";
import { useUserStore } from "@/lib/state/useUserStore";
import { AnswerButtons, STEP_CARD } from "./AnswerButtons";
import { BlinkPanel } from "./BlinkPanel";
import { useAnswerKeys } from "./useAnswerKeys";
import { FieldGuideDialog } from "@/components/projects/FieldGuideDialog";

const BATCH = 10;

/** Classify flow (design §8.5): a batch of 10 fields with progress, answers, and demo agreement. */
export function ClassifyFlow({ project }: { project: ProjectDef }) {
  const { t } = useT();
  const batch = useUserStore((s) => s.batch);
  const setBatch = useUserStore((s) => s.setBatch);
  const classifications = useUserStore((s) => s.classifications);
  const [sessionBatches, setSessionBatches] = useState(0);
  const active = batch && batch.projectSlug === project.slug ? batch : null;

  useEffect(() => {
    if (!active) setBatch({ projectSlug: project.slug, offset: 0, index: 0, size: BATCH });
  }, [active, project.slug, setBatch]);

  const offset = active?.offset ?? 0;
  const index = active?.index ?? 0;
  const { fields, error } = useProjectQueue(project.slug, offset, BATCH);
  const field = fields?.[index];
  const complete = index >= BATCH;

  function next() {
    if (!active) return;
    if (index + 1 >= BATCH) {
      setSessionBatches((n) => n + 1);
      setBatch({ ...active, index: BATCH });
    } else {
      setBatch({ ...active, index: index + 1 });
    }
  }

  function startBatch(newOffset: number) {
    setBatch({ projectSlug: project.slug, offset: newOffset, index: 0, size: BATCH });
  }

  const mine = classifications.filter((c) => !c.isTraining);
  const totalFlagged = mine.filter((c) => c.flaggedInteresting).length;

  if (error) {
    return <Banner text={t("explore.errorBody")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Link
          href={`/projects/${project.slug}`}
          className="self-start text-body-sm text-primary hover:underline"
        >
          ← {t(project.titleKey)}
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone="primary">{t("classify.badge")}</Badge>
          <FieldGuideDialog />
        </div>
        <h2 className="font-display text-h2 font-semibold text-text-primary">
          {t(project.questionKey)}
        </h2>
        <p className="text-body-sm text-text-secondary">{t("classify.hint")}</p>
      </div>

      {complete ? (
        <BatchComplete
          sessionBatches={sessionBatches}
          checked={BATCH}
          total={mine.length}
          flagged={totalFlagged}
          onMore={() => startBatch(offset + BATCH)}
        />
      ) : field ? (
        <BlinkPanel
          key={field.fieldId}
          target={field.target}
          advanced
          actions={
            <ClassifyStep
              key={`${offset}-${index}`}
              project={project}
              field={field}
              index={index}
              onNext={next}
            />
          }
        />
      ) : (
        <Card>
          <p className="text-body-sm text-text-muted">{t("common.loading")}</p>
        </Card>
      )}

      <ContributionProgress
        title={t("classify.progressTitle")}
        done={Math.min(index, BATCH)}
        total={BATCH}
        caption={t("classify.percentComplete")}
        stats={[
          { label: t("classify.statChecked"), value: String(Math.min(index, BATCH)) },
          { label: t("classify.statLeft"), value: String(Math.max(BATCH - index, 0)) },
          { label: t("classify.statBatch"), value: String(BATCH) },
        ]}
      />
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-body-sm text-danger">{text}</p>
    </Card>
  );
}

/** One field: answer buttons, flag, and the feedback after answering. */
function ClassifyStep({
  project,
  field,
  index,
  onNext,
}: {
  project: ProjectDef;
  field: QueueField;
  index: number;
  onNext: () => void;
}) {
  const { t } = useT();
  const addClassification = useUserStore((s) => s.addClassification);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [flagged, setFlagged] = useState(false);

  function choose(a: Answer) {
    if (answer) return;
    setAnswer(a);
    addClassification({
      id: `${Date.now()}-${index}`,
      projectSlug: project.slug,
      fieldId: field.fieldId,
      answer: a,
      flaggedInteresting: flagged,
      isTraining: false,
      agrees: field.demoAgreement ? field.demoAgreement.answer === a : undefined,
      createdAt: new Date().toISOString(),
    });
  }

  useAnswerKeys({
    answers: project.answers,
    answered: answer !== null,
    onAnswer: choose,
    onNext,
  });

  const agreement = field.demoAgreement;
  const sameAsDemo = agreement && answer === agreement.answer;

  return (
    <Card className={STEP_CARD}>
      <AnswerButtons
        answers={project.answers}
        selected={answer}
        disabled={answer !== null}
        onAnswer={choose}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chip
          selected={flagged}
          aria-label={t("classify.flag")}
          onClick={() => setFlagged((v) => !v)}
          disabled={answer !== null}
        >
          {t("classify.flag")}
        </Chip>
        {answer === null && (
          <span className="hidden text-caption text-text-muted sm:inline">{t("classify.keysHint")}</span>
        )}
      </div>

      {answer !== null && agreement && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t("common.demoData")}</Badge>
          </div>
          <p className="text-body text-text-primary">
            {fill(t("classify.thanks"), {
              percent: agreement.percent,
              answer: t(ANSWER_LABEL[agreement.answer] as DictKey),
            })}
          </p>
          <p className="text-body-sm text-text-secondary">
            {sameAsDemo ? t("classify.matches") : t("classify.differs")}
          </p>
          <div className="flex justify-end">
            <Button onClick={onNext}>
              {index + 1 >= 10 ? t("classify.finish") : t("classify.next")}
              <span className="ml-2 font-mono text-caption opacity-80">Enter</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Batch complete screen (design §8.5). A rest suggestion appears after two batches in a row. */
function BatchComplete({
  sessionBatches,
  checked,
  total,
  flagged,
  onMore,
}: {
  sessionBatches: number;
  checked: number;
  total: number;
  flagged: number;
  onMore: () => void;
}) {
  const { t } = useT();
  return (
    <Card className="flex flex-col gap-6">
      <h2 className="font-display text-h2 font-semibold text-text-primary">
        {t("classify.complete")}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label={t("classify.kpiChecked")} value={checked} />
        <KpiTile label={t("classify.kpiTotal")} value={total} />
        <KpiTile label={t("classify.kpiFlagged")} value={flagged} />
      </div>
      {sessionBatches >= 2 && (
        <p role="note" className="text-body text-text-secondary">
          {t("classify.rest")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={onMore}>{t("classify.more")}</Button>
        <Link href="/me" className={buttonStyles({ variant: "secondary" })}>
          {t("classify.stats")}
        </Link>
      </div>
    </Card>
  );
}
