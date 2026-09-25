/**
 * Exam & Quiz Milestone Planner — the countdown sprint inside "خريطة المقرر".
 *
 * Pure client-side scheduling: it paces the concepts of the selected chapters over
 * the days left before the exam and reserves the tail days for the bug-hunt
 * marathon. No AI call, no tokens.
 */
import {
  Concept,
  ExamMilestonePlan,
  MilestoneDayKind,
  MilestoneDayPlan,
  MilestoneIntensity,
  MilestoneKind,
  RoadmapConceptRef,
  SavedCourse,
} from '../types';
import { conceptStatus } from './courseStore';
import { addDays, daysBetween, parseIsoDate, startOfToday, toIsoDate } from './roadmap';

interface CountForms {
  one: string;
  /** Oblique dual (يومين): the form these phrases need after a preposition. */
  two: string;
  /** 3–10 take the broken plural. */
  few: string;
  /** 11+ take the singular accusative (تمييز). */
  many: string;
}

export const DAYS: CountForms = { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يوماً' };
export const CONCEPTS: CountForms = {
  one: 'مفهوم واحد',
  two: 'مفهومين',
  few: 'مفاهيم',
  many: 'مفهوماً',
};
export const SESSIONS: CountForms = {
  one: 'جلسة واحدة',
  two: 'جلستين',
  few: 'جلسات',
  many: 'جلسة',
};

/** Arabic number agreement, so the duck never says "12 أيام" or "2 يوماً". */
export function arabicCount(n: number, forms: CountForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}

export const MILESTONE_KIND_LABEL: Record<MilestoneKind, string> = {
  quiz: 'كويز',
  midterm: 'اختبار نصفي',
  final: 'اختبار نهائي',
  project: 'مشروع',
};

/** Kinds the planner form offers; a project has no revision sprint. */
export const PLANNABLE_KINDS: MilestoneKind[] = ['quiz', 'midterm', 'final'];

/** Chapter label as stored on a concept, stripped of the extractor's brackets. */
export function chapterLabel(concept: Concept): string {
  return (concept.chapterOrUnit || '').replace(/^\[|\]$/g, '').trim() || 'وحدة غير مصنفة';
}

/** Distinct chapters of a course, in the order the concepts were extracted. */
export function courseChapters(concepts: Concept[]): string[] {
  const seen: string[] = [];
  for (const concept of concepts) {
    const label = chapterLabel(concept);
    if (!seen.includes(label)) seen.push(label);
  }
  return seen;
}

export function conceptsInChapters(concepts: Concept[], chapters: string[]): Concept[] {
  if (chapters.length === 0) return [];
  return concepts.filter((concept) => chapters.includes(chapterLabel(concept)));
}

/** Days from today up to (not including) the exam; 1 when the exam is today or past. */
export function studyDaysUntil(examDate: string, now: Date = startOfToday()): number {
  return Math.max(daysBetween(now, parseIsoDate(examDate)), 1);
}

/** Buffer days kept free of new material, scaled to how much runway there is. */
function bufferDaysFor(totalDays: number): number {
  if (totalDays >= 5) return 2;
  if (totalDays >= 3) return 1;
  return 0;
}

export interface MilestonePlanInput {
  title: string;
  kind: MilestoneKind;
  examDate: string;
  chapters: string[];
  intensity: MilestoneIntensity;
  concepts: Concept[];
}

/**
 * Paces the in-scope concepts across the countdown, honouring the requested daily
 * intensity where the runway allows and flagging it when the exam forces a faster pace.
 */
export function buildMilestonePlan(input: MilestonePlanInput): ExamMilestonePlan {
  const { title, kind, examDate, chapters, intensity } = input;
  const today = startOfToday();

  const scoped = conceptsInChapters(input.concepts, chapters);
  const totalDays = studyDaysUntil(examDate, today);
  const buffer = bufferDaysFor(totalDays);
  const teachingDays = Math.max(totalDays - buffer, 1);

  // Spread the concepts evenly across the whole runway instead of cramming them up
  // front: when the scope is small the gaps become spacing days, and only the
  // reserved tail is the bug-hunt marathon.
  const total = scoped.length;
  const perDay = Math.max(Math.ceil(total / teachingDays), 1);

  const days: MilestoneDayPlan[] = [];
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const isTail = dayIndex >= teachingDays;
    const slice = isTail
      ? []
      : scoped.slice(
          Math.ceil((dayIndex * total) / teachingDays),
          Math.ceil(((dayIndex + 1) * total) / teachingDays)
        );

    const kind: MilestoneDayKind = isTail ? 'buffer' : slice.length > 0 ? 'study' : 'rest';

    days.push({
      dayIndex: dayIndex + 1,
      date: toIsoDate(addDays(today, dayIndex)),
      kind,
      concepts: slice.map<RoadmapConceptRef>((concept) => ({
        conceptId: concept.id,
        name: concept.name,
        highYield: concept.difficulty === 'advanced',
        activity: concept.difficulty === 'advanced' ? 'bugHunt' : 'voice',
      })),
    });
  }

  return {
    id: `milestone-${Date.now()}`,
    title,
    kind,
    examDate,
    chapters,
    intensity,
    conceptIds: scoped.map((concept) => concept.id),
    days,
    isOverloaded: perDay > intensity,
    paceNote:
      perDay > intensity
        ? `الوقت ضيق: ${arabicCount(total, CONCEPTS)} على ${arabicCount(teachingDays, DAYS)} يعني ${arabicCount(perDay, SESSIONS)} يومياً بدل ${intensity}. شدّ حيلك أو قلّص نطاق التغطية.`
        : perDay < intensity
        ? `وقتك يسمح: ${arabicCount(perDay, SESSIONS)} يومياً تكفي لتغطية ${arabicCount(total, CONCEPTS)} قبل الموعد، مو لازم ${intensity}. خفّف وثبّت أحسن.`
        : `الإيقاع مضبوط: ${arabicCount(perDay, SESSIONS)} يومياً تغطي ${arabicCount(total, CONCEPTS)} قبل الموعد.`,
    createdAt: Date.now(),
  };
}

/** Whole days left before the exam; negative once it has passed. */
export function milestoneCountdown(plan: ExamMilestonePlan, now: Date = startOfToday()): number {
  return daysBetween(now, parseIsoDate(plan.examDate));
}

/** Share of the milestone's scope already explained convincingly to the duck. */
export function milestoneProgress(plan: ExamMilestonePlan, course: SavedCourse): number {
  if (plan.conceptIds.length === 0) return 0;
  const mastered = plan.conceptIds.filter(
    (id) => conceptStatus(course, id) === 'mastered'
  ).length;
  return Math.round((mastered / plan.conceptIds.length) * 100);
}

/** The sprint card for today, or null once the plan's window has passed. */
export function todaysMilestoneDay(
  plan: ExamMilestonePlan,
  now: Date = startOfToday()
): MilestoneDayPlan | null {
  const todayIso = toIsoDate(now);
  return plan.days.find((day) => day.date === todayIso) ?? null;
}

/** Concepts of the plan still unmastered, used to stock the bug-hunt marathon days. */
export function milestonePendingConcepts(
  plan: ExamMilestonePlan,
  course: SavedCourse
): RoadmapConceptRef[] {
  const pending = new Map<string, RoadmapConceptRef>();
  for (const day of plan.days) {
    for (const ref of day.concepts) {
      if (!ref.conceptId || pending.has(ref.conceptId)) continue;
      if (conceptStatus(course, ref.conceptId) === 'mastered') continue;
      pending.set(ref.conceptId, ref);
    }
  }
  return [...pending.values()];
}
