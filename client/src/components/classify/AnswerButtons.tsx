"use client";

import { Button } from "@/components/ui/Button";
import { ANSWER_LABEL } from "@/data/projects";
import { useT } from "@/lib/i18n/LangProvider";
import type { Answer } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

/**
 * Neutral answer buttons (design §8.5, §9.1): no green or red, selected = primary border and fill.
 * Keys 1–4 answer; the key hint is shown on each button.
 */
export function AnswerButtons({
  answers,
  selected,
  disabled,
  onAnswer,
}: {
  answers: readonly Answer[];
  selected: Answer | null;
  disabled: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {answers.map((answer, i) => (
        <Button
          key={answer}
          variant="secondary"
          size="answer"
          aria-pressed={selected === answer}
          disabled={disabled}
          onClick={() => onAnswer(answer)}
          className={cn(
            "justify-between text-left",
            selected === answer && "border-2 border-primary bg-primary-subtle",
          )}
        >
          <span>{t(ANSWER_LABEL[answer])}</span>
          <kbd className="rounded-[4px] border border-border-strong px-1.5 font-mono text-caption text-text-muted">
            {i + 1}
          </kbd>
        </Button>
      ))}
    </div>
  );
}
