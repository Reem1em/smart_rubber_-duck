/**
 * Question generation has one entry point: "ولّد أسئلة" (step 'generateQuestions').
 * The former "اختبار تدريبي" view ('practice') was merged into it; the step id is kept as an
 * alias so any saved state or old link still lands on the working flow.
 */
import type { AppStep } from './types';

export const QUESTIONS_STEP = 'generateQuestions' as const satisfies AppStep;

export const QUESTIONS_NAV = {
  key: QUESTIONS_STEP,
  label: 'ولّد أسئلة',
  title: 'ولّد أسئلة تدريبية من نموذج اختبار أو من ملفات مادتك',
} as const;

const STEP_ALIASES: Partial<Record<AppStep, AppStep>> = {
  practice: QUESTIONS_STEP,
};

/** The step actually rendered for `step`. */
export function canonicalStep(step: AppStep): AppStep {
  return STEP_ALIASES[step] ?? step;
}
