import type { Answer, Detector, TaskType } from "@/lib/data/types";
import type { DictKey } from "@/lib/i18n/en";

/**
 * The four citizen-science projects (architecture §3, PROMPT Phase 4). Each has its own question
 * and answer buttons (design §8.5).
 */
export interface ProjectDef {
  slug: string;
  taskType: TaskType;
  difficulty: "beginner" | "intermediate" | "advanced";
  defaultDetector: Detector;
  fieldCount: number;
  titleKey: DictKey;
  descriptionKey: DictKey;
  questionKey: DictKey;
  /** Buttons in display order, with their key hints 1–4. */
  answers: readonly Answer[];
}

const MOTION_ANSWERS = ["moved", "no_change", "not_sure", "glitch"] as const;
const VARIABILITY_ANSWERS = ["brightness", "no_change", "not_sure", "glitch"] as const;
const GLITCH_ANSWERS = ["real", "glitch", "not_sure"] as const;

export const PROJECTS: readonly ProjectDef[] = [
  {
    slug: "hunt-moving-stars",
    taskType: "motion",
    difficulty: "beginner",
    defaultDetector: "D2",
    fieldCount: 120,
    titleKey: "project.motion.title",
    descriptionKey: "project.motion.desc",
    questionKey: "project.motion.question",
    answers: MOTION_ANSWERS,
  },
  {
    slug: "brown-dwarfs",
    taskType: "motion",
    difficulty: "intermediate",
    defaultDetector: "D6",
    fieldCount: 80,
    titleKey: "project.brown.title",
    descriptionKey: "project.brown.desc",
    questionKey: "project.brown.question",
    answers: MOTION_ANSWERS,
  },
  {
    slug: "variable-watch",
    taskType: "variability",
    difficulty: "intermediate",
    defaultDetector: "D3",
    fieldCount: 100,
    titleKey: "project.variable.title",
    descriptionKey: "project.variable.desc",
    questionKey: "project.variable.question",
    answers: VARIABILITY_ANSWERS,
  },
  {
    slug: "glitch-patrol",
    taskType: "glitch",
    difficulty: "advanced",
    defaultDetector: "D3",
    fieldCount: 60,
    titleKey: "project.glitch.title",
    descriptionKey: "project.glitch.desc",
    questionKey: "project.glitch.question",
    answers: GLITCH_ANSWERS,
  },
];

export function projectBySlug(slug: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

/** The answer that the synthetic data supports for each task (used for training and demo agreement). */
export const ANSWER_LABEL: Record<Answer, DictKey> = {
  moved: "answer.moved",
  brightness: "answer.brightness",
  no_change: "answer.noChange",
  not_sure: "answer.notSure",
  glitch: "answer.glitch",
  real: "answer.real",
};
