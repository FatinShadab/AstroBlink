"use client";

import { useEffect, useRef } from "react";
import type { Answer } from "@/lib/data/types";

/**
 * Keys for the classify and training pages: 1–4 answer, Enter goes to the next field (design §10).
 * Ignored while the user types in a form field.
 */
export function useAnswerKeys(opts: {
  answers: readonly Answer[];
  answered: boolean;
  onAnswer: (answer: Answer) => void;
  onNext: () => void;
}) {
  const ref = useRef(opts);
  useEffect(() => {
    ref.current = opts;
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"))
        return;
      const current = ref.current;
      if (event.key === "Enter" && current.answered) {
        event.preventDefault();
        current.onNext();
        return;
      }
      const digit = Number(event.key);
      if (
        Number.isInteger(digit) &&
        digit >= 1 &&
        digit <= current.answers.length &&
        !current.answered
      ) {
        current.onAnswer(current.answers[digit - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
