"use client";

import { Button } from "@/components/ui/Button";
import { ANSWER_LABEL } from "@/data/projects";
import { useT } from "@/lib/i18n/LangProvider";
import type { Answer } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

/**
 * The answer card around these buttons (classify and training): a card in the column beside the viewer,
 * and borderless inside the bottom bar on narrow screens.
 */
export const STEP_CARD =
  "flex w-full flex-col gap-3 max-lg:border-0 max-lg:bg-transparent max-lg:p-0 lg:gap-4";

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
    // Two columns: compact enough for the bottom bar on phones and the side column on desktop.
    // Equal-height rows; labels wrap at word boundaries in a smaller size so no button grows to three lines.
    <div className="grid auto-rows-fr grid-cols-2 gap-2 lg:gap-3">
      {answers.map((answer, i) => (
        <Button
          key={answer}
          variant="secondary"
          size="answer"
          aria-pressed={selected === answer}
          disabled={disabled}
          onClick={() => onAnswer(answer)}
          className={cn(
            "h-full items-center justify-between gap-2 px-3 py-2 text-left text-body-sm leading-snug whitespace-normal",
            // Same border width selected or not, so the label never shifts.
            selected === answer && "border-primary bg-primary-subtle ring-1 ring-primary ring-inset",
          )}
        >
          <span className="min-w-0 text-balance">{t(ANSWER_LABEL[answer])}</span>
          <kbd className="shrink-0 rounded-[4px] border border-border-strong px-1.5 font-mono text-caption text-text-muted">
            {i + 1}
          </kbd>
        </Button>
      ))}
    </div>
  );
}
