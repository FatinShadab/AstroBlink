"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Surfaces";
import { ContributionProgress } from "./ContributionProgress";
import { ANSWER_LABEL, type ProjectDef } from "@/data/projects";
import { useT } from "@/lib/i18n/LangProvider";
import { fill } from "@/lib/i18n/format";
import type { DictKey } from "@/lib/i18n/en";
import type { Answer, QueueField } from "@/lib/data/types";
import { useProjectQueue } from "@/lib/projects/useProjectQueue";
import { useUserStore } from "@/lib/state/useUserStore";
import { AnswerButtons } from "./AnswerButtons";
import { BlinkPanel } from "./BlinkPanel";
import { useAnswerKeys } from "./useAnswerKeys";
import { FieldGuideDialog } from "@/components/projects/FieldGuideDialog";

const PRACTICE_SIZE = 5;

/** Training round (design §8.5): five practice fields with known answers, feedback after each. */
export function TrainFlow({ project }: { project: ProjectDef }) {
  const { t } = useT();
  const { fields, error } = useProjectQueue(project.slug, -1, PRACTICE_SIZE);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const markTrainingDone = useUserStore((s) => s.markTrainingDone);
  const complete = fields !== null && index >= fields.length;

  useEffect(() => {
    if (complete) markTrainingDone(project.slug);
  }, [complete, project.slug, markTrainingDone]);

  if (error) {
    return (
      <Card>
        <p className="text-body-sm text-danger">{t("explore.errorBody")}</p>
      </Card>
    );
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
        <div className="flex justify-center">
          <Badge tone="primary">{t("train.badge")}</Badge>
          <FieldGuideDialog />
        </div>
        <h2 className="font-display text-h2 font-semibold text-text-primary">
          {t(project.questionKey)}
        </h2>
        <p className="text-body-sm text-text-secondary">{t("train.hint")}</p>
      </div>

      {complete ? (
        <Card className="flex flex-col gap-4">
          <h3 className="font-display text-h3 font-medium text-text-primary">{t("train.done")}</h3>
          <p className="text-body text-text-secondary">
            {fill(t("train.score"), {
              correct: results.filter(Boolean).length,
              total: fields.length,
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${project.slug}/classify`}
              className={buttonStyles({ variant: "primary" })}
            >
              {t("train.toClassify")}
            </Link>
          </div>
        </Card>
      ) : fields && fields[index] ? (
        <>
          <BlinkPanel key={fields[index].fieldId} target={fields[index].target} advanced />
          <TrainStep
            key={index}
            project={project}
            field={fields[index]}
            index={index}
            onDone={(correct) => {
              setResults((r) => [...r, correct]);
              setIndex((i) => i + 1);
            }}
          />
        </>
      ) : (
        <Card>
          <p className="text-body-sm text-text-muted">{t("common.loading")}</p>
        </Card>
      )}

      <ContributionProgress
        title={t("classify.progressTitle")}
        done={Math.min(index, PRACTICE_SIZE)}
        total={PRACTICE_SIZE}
        caption={t("classify.percentComplete")}
        stats={[
          { label: t("classify.statChecked"), value: String(Math.min(index, PRACTICE_SIZE)) },
          { label: t("classify.statLeft"), value: String(Math.max(PRACTICE_SIZE - index, 0)) },
          { label: t("classify.statBatch"), value: String(PRACTICE_SIZE) },
        ]}
      />
    </div>
  );
}

function TrainStep({
  project,
  field,
  index,
  onDone,
}: {
  project: ProjectDef;
  field: QueueField;
  index: number;
  onDone: (correct: boolean) => void;
}) {
  const { t } = useT();
  const addClassification = useUserStore((s) => s.addClassification);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const truth = field.truth ?? "not_sure";
  const correct = answer !== null && answer === truth;

  function choose(a: Answer) {
    if (answer) return;
    setAnswer(a);
    addClassification({
      id: `train-${Date.now()}-${index}`,
      projectSlug: project.slug,
      fieldId: field.fieldId,
      answer: a,
      flaggedInteresting: false,
      isTraining: true,
      correct: a === truth,
      createdAt: new Date().toISOString(),
    });
  }

  useAnswerKeys({
    answers: project.answers,
    answered: answer !== null,
    onAnswer: choose,
    onNext: () => onDone(correct),
  });

  return (
    <Card className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <AnswerButtons
        answers={project.answers}
        selected={answer}
        disabled={answer !== null}
        onAnswer={choose}
      />
      {answer !== null && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4"
        >
          <p className="text-body font-medium text-text-primary">
            <span aria-hidden="true">{correct ? "✓ " : "✕ "}</span>
            {correct ? t("train.correct") : t("train.notQuite")}
          </p>
          <p className="text-body-sm text-text-secondary">
            {t(field.explanationKey as DictKey)}
            {!correct && (
              <> {fill(t("train.itWas"), { answer: t(ANSWER_LABEL[truth] as DictKey) })}</>
            )}
          </p>
          <div className="flex justify-end">
            <Button onClick={() => onDone(correct)}>
              {t("classify.next")}
              <span className="ml-2 font-mono text-caption opacity-80">Enter</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
