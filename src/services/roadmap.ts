/**
 * Scheduling engine behind "خريطة المقرر" (Course Roadmap).
 *
 * Everything here is pure and synchronous: Mode B (الخطة الذكية التلقائية) builds a
 * full week-by-week roadmap locally with zero AI calls, and Mode A only normalizes
 * what the syllabus parser returned. The result is cached on the course record, so
 * a syllabus costs tokens exactly once.
 */
import {
  Concept,
  ConceptStatus,
  CourseRoadmap,
  MilestoneKind,
  ParsedSyllabus,
  RoadmapConceptRef,
  RoadmapMilestone,
  RoadmapWeek,
  SavedCourse,
  SprintActivity,
} from '../types';
import { conceptStatus } from './courseStore';

/** Budgeted study hours per concept: one explanation sprint plus its follow-up drill. */
const HOURS_PER_CONCEPT = 1.5;
const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ dates */

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses YYYY-MM-DD at local midnight; invalid input resolves to today. */
export function parseIsoDate(iso: string | undefined): Date {
  const parsed = iso ? new Date(`${iso}T00:00:00`) : new Date(NaN);
  if (Number.isNaN(parsed.getTime())) return startOfToday();
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Whole days from `from` to `to`; negative once the target has passed. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function formatArabicDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* --------------------------------------------------------- concept matching */

/** Strips diacritics, tatweel, punctuation and alef/yaa variants so names compare reliably. */
export function normalizeConceptName(raw: string): string {
  return (raw || '')
    // Syllabi mix Arabic-Indic and Latin digits for the same unit number.
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** Resolves a syllabus topic title onto an extracted concept id, or null when unmatched. */
export function matchConceptId(concepts: Concept[], name: string): string | null {
  const target = normalizeConceptName(name);
  if (!target) return null;

  const exact = concepts.find((c) => normalizeConceptName(c.name) === target);
  if (exact) return exact.id;

  // Syllabi phrase topics more loosely than the extractor ("مقدمة في الأشجار الثنائية"
  // vs "الأشجار الثنائية"), so fall back to containment in either direction.
  const partial = concepts.find((c) => {
    const candidate = normalizeConceptName(c.name);
    return candidate.length > 3 && (candidate.includes(target) || target.includes(candidate));
  });
  return partial?.id ?? null;
}

/** Advanced concepts are drilled in the code lab; everything else is explained aloud. */
function activityFor(concept: Concept | undefined): SprintActivity {
  return concept?.difficulty === 'advanced' ? 'bugHunt' : 'voice';
}

/* -------------------------------------------------- Mode B: dynamic auto plan */

export interface AutoPlanInput {
  courseId: string;
  courseName: string;
  concepts: Concept[];
  /** YYYY-MM-DD of the exam the plan drives toward. */
  targetExamDate: string;
  weeklyHours: number;
}

/**
 * Spreads the currently extracted concepts across the weeks left before the exam,
 * reserving the final week for consolidation whenever the horizon allows it.
 */
export function buildAutoRoadmap(input: AutoPlanInput): CourseRoadmap {
  const { courseId, courseName, concepts, weeklyHours } = input;
  const today = startOfToday();
  const exam = parseIsoDate(input.targetExamDate);

  const daysLeft = Math.max(daysBetween(today, exam), 1);
  const totalWeeks = Math.max(Math.ceil(daysLeft / 7), 1);
  // A dedicated consolidation week only earns its place on a horizon of 3+ weeks.
  const hasReviewWeek = totalWeeks >= 3;
  const teachingWeeks = Math.max(hasReviewWeek ? totalWeeks - 1 : totalWeeks, 1);

  const perWeek = Math.max(Math.ceil(concepts.length / teachingWeeks), 1);
  const capacity = Math.max(Math.floor(weeklyHours / HOURS_PER_CONCEPT), 1);

  const weeks: RoadmapWeek[] = [];
  for (let weekIndex = 0; weekIndex < teachingWeeks; weekIndex++) {
    const slice = concepts.slice(weekIndex * perWeek, (weekIndex + 1) * perWeek);
    const startDate = addDays(today, weekIndex * 7);
    weeks.push({
      weekNumber: weekIndex + 1,
      title: weekTitleFrom(slice, weekIndex + 1),
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(addDays(startDate, 6)),
      isReviewWeek: false,
      concepts: slice.map<RoadmapConceptRef>((concept) => ({
        conceptId: concept.id,
        name: concept.name,
        highYield: concept.difficulty === 'advanced',
        activity: activityFor(concept),
      })),
    });
  }

  if (hasReviewWeek) {
    const startDate = addDays(today, teachingWeeks * 7);
    weeks.push({
      weekNumber: teachingWeeks + 1,
      title: 'أسبوع إعادة التثبيت قبل الاختبار',
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(exam),
      isReviewWeek: true,
      concepts: [],
    });
  }

  const milestones: RoadmapMilestone[] = [
    {
      id: 'auto-target-exam',
      title: 'الاختبار المستهدف',
      kind: 'final',
      weekNumber: weeks.length,
      date: toIsoDate(exam),
      gradeWeight: 0,
      coversWeeks: weeks.map((w) => w.weekNumber),
      highYield: true,
    },
  ];

  return {
    courseId,
    courseName,
    source: 'auto',
    startDate: toIsoDate(today),
    totalWeeks: weeks.length,
    weeklyHours,
    weeks,
    milestones,
    duckNote:
      perWeek > capacity
        ? `كواك! عندك ${concepts.length} مفهوماً في ${daysLeft} يوماً — يعني ${perWeek} مفاهيم بالأسبوع، وساعاتك تكفي ${capacity} بس. إما نزيد الساعات أو نركّز على المفاهيم عالية الوزن أول.`
        : `كواك! وزّعت ${concepts.length} مفهوماً على ${weeks.length} أسبوع بمعدل ${perWeek} بالأسبوع. مشوار مريح، بس لا تتأخر عليّ.`,
    createdAt: Date.now(),
  };
}

/** Names a week after the unit most of its concepts belong to. */
function weekTitleFrom(slice: Concept[], weekNumber: number): string {
  const unit = slice.find((c) => c.chapterOrUnit?.trim())?.chapterOrUnit?.trim();
  const cleaned = unit?.replace(/^\[|\]$/g, '').trim();
  return cleaned || `الأسبوع ${weekNumber}`;
}

/* ------------------------------------------- Mode A: syllabus normalization */

const MILESTONE_KINDS: MilestoneKind[] = ['midterm', 'final', 'quiz', 'project'];

/** A milestone worth this much of the grade marks its units as high-yield. */
const HIGH_YIELD_WEIGHT = 20;

/**
 * Turns the parser's loose output into a strict roadmap: sequential weeks, real dates,
 * concept ids resolved against the course, and high-yield flags derived from grade weights.
 */
export function normalizeParsedSyllabus(
  parsed: ParsedSyllabus,
  options: { courseId: string; courseName: string; concepts: Concept[]; weeklyHours: number }
): CourseRoadmap {
  const { courseId, concepts, weeklyHours } = options;
  const startDate = parseIsoDate(parsed.startDate);

  const rawWeeks = (parsed.weeks ?? []).filter((w) => Array.isArray(w?.concepts) || w?.title);

  const weeks: RoadmapWeek[] = rawWeeks.map((week, index) => {
    const weekNumber = index + 1;
    const weekStart = addDays(startDate, index * 7);
    const names = (week.concepts ?? []).map((n) => String(n).trim()).filter(Boolean);

    return {
      weekNumber,
      title: (week.title || `الأسبوع ${weekNumber}`).trim(),
      startDate: toIsoDate(weekStart),
      endDate: toIsoDate(addDays(weekStart, 6)),
      isReviewWeek: Boolean(week.isReviewWeek) || /مراجع|تثبيت|review/i.test(week.title || ''),
      concepts: names.map<RoadmapConceptRef>((name) => {
        const conceptId = matchConceptId(concepts, name);
        const concept = concepts.find((c) => c.id === conceptId);
        return {
          conceptId,
          name: concept?.name ?? name,
          highYield: Boolean(week.highYield),
          activity: activityFor(concept),
        };
      }),
    };
  });

  const milestones: RoadmapMilestone[] = (parsed.milestones ?? [])
    .filter((m) => m?.title)
    .map((milestone, index) => {
      const weekNumber = clampWeek(milestone.weekNumber, weeks.length);
      const anchorWeek = weeks[weekNumber - 1];
      const kind = (MILESTONE_KINDS as string[]).includes(String(milestone.kind))
        ? (milestone.kind as MilestoneKind)
        : 'quiz';
      const gradeWeight = Number.isFinite(milestone.gradeWeight)
        ? Math.max(0, Math.min(100, Number(milestone.gradeWeight)))
        : 0;
      const coversWeeks = (milestone.coversWeeks ?? [])
        .map((w) => clampWeek(w, weeks.length))
        .filter((w, i, arr) => arr.indexOf(w) === i);

      return {
        id: `milestone-${index + 1}`,
        title: String(milestone.title).trim(),
        kind,
        weekNumber,
        date: isValidIso(milestone.date)
          ? (milestone.date as string)
          : anchorWeek?.endDate ?? toIsoDate(addDays(startDate, weekNumber * 7 - 1)),
        gradeWeight,
        coversWeeks:
          coversWeeks.length > 0
            ? coversWeeks
            : weeks.slice(0, weekNumber).map((w) => w.weekNumber),
        highYield: gradeWeight >= HIGH_YIELD_WEIGHT || kind === 'final' || kind === 'midterm',
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // A syllabus lists "الاختبار النصفي الأول" as the week's content. Such a row is the
  // milestone itself, not study material, so it must not sit in the mastery ledger.
  const milestoneTitles = new Set(milestones.map((m) => normalizeConceptName(m.title)));
  for (const week of weeks) {
    week.concepts = week.concepts.filter(
      (ref) => ref.conceptId !== null || !milestoneTitles.has(normalizeConceptName(ref.name))
    );
  }

  // Any week feeding a heavy milestone inherits its priority flag. A milestone that
  // covers the whole term (typically the final) is skipped: flagging every week would
  // make the priority flag meaningless.
  const highYieldWeeks = new Set(
    milestones
      .filter((m) => m.highYield && m.coversWeeks.length < weeks.length)
      .flatMap((m) => m.coversWeeks)
  );
  for (const week of weeks) {
    if (!highYieldWeeks.has(week.weekNumber)) continue;
    week.concepts = week.concepts.map((ref) => ({ ...ref, highYield: true }));
  }

  return {
    courseId,
    courseName: (parsed.courseName || options.courseName || 'المقرر الدراسي').trim(),
    source: 'syllabus',
    startDate: toIsoDate(startDate),
    totalWeeks: weeks.length,
    weeklyHours,
    weeks,
    milestones,
    duckNote:
      parsed.duckNote?.trim() ||
      `كواك! قريت توصيف المادة كامل: ${weeks.length} أسبوعاً و${milestones.length} محطة تقييم. خلنا نمشي أسبوع بأسبوع.`,
    createdAt: Date.now(),
  };
}

function clampWeek(value: unknown, totalWeeks: number): number {
  const week = Number(value);
  if (!Number.isFinite(week) || week < 1) return 1;
  return Math.min(Math.round(week), Math.max(totalWeeks, 1));
}

function isValidIso(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/* ------------------------------------------------------- progress & sprints */

/** 1-based academic week for `now`, clamped inside the roadmap horizon. */
export function currentWeekNumber(roadmap: CourseRoadmap, now: Date = startOfToday()): number {
  const elapsed = daysBetween(parseIsoDate(roadmap.startDate), now);
  if (elapsed < 0) return 1;
  return Math.min(Math.floor(elapsed / 7) + 1, Math.max(roadmap.totalWeeks, 1));
}

export function allConceptRefs(roadmap: CourseRoadmap): RoadmapConceptRef[] {
  return roadmap.weeks.flatMap((week) => week.concepts);
}

/** Overall completion: mastered concepts over everything the roadmap schedules. */
export function roadmapProgress(roadmap: CourseRoadmap, course: SavedCourse): number {
  const refs = allConceptRefs(roadmap);
  if (refs.length === 0) return 0;
  const mastered = refs.filter((ref) => conceptStatus(course, ref.conceptId) === 'mastered').length;
  return Math.round((mastered / refs.length) * 100);
}

export function statusOf(course: SavedCourse, ref: RoadmapConceptRef): ConceptStatus {
  return conceptStatus(course, ref.conceptId);
}

export interface MilestoneCountdown {
  milestone: RoadmapMilestone;
  daysRemaining: number;
  pendingConcepts: number;
}

/** The next milestone that has not passed yet, with what still stands between it and the student. */
export function nextMilestone(
  roadmap: CourseRoadmap,
  course: SavedCourse,
  now: Date = startOfToday()
): MilestoneCountdown | null {
  const upcoming = roadmap.milestones.find((m) => daysBetween(now, parseIsoDate(m.date)) >= 0);
  if (!upcoming) return null;

  const covered = new Set(upcoming.coversWeeks);
  const pendingConcepts = roadmap.weeks
    .filter((week) => covered.has(week.weekNumber))
    .flatMap((week) => week.concepts)
    .filter((ref) => statusOf(course, ref) !== 'mastered').length;

  return {
    milestone: upcoming,
    daysRemaining: daysBetween(now, parseIsoDate(upcoming.date)),
    pendingConcepts,
  };
}

/**
 * Spaced repetition bucket: every concept from the current week or earlier that a
 * verbal session flagged as a gap. The week is not "done" while this list is non-empty.
 */
export function reviewBucket(
  roadmap: CourseRoadmap,
  course: SavedCourse,
  upToWeek: number
): RoadmapConceptRef[] {
  const seen = new Set<string>();
  return roadmap.weeks
    .filter((week) => week.weekNumber <= upToWeek)
    .flatMap((week) => week.concepts)
    .filter((ref) => {
      if (statusOf(course, ref) !== 'gap') return false;
      const key = ref.conceptId ?? ref.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** True once every concept scheduled in the week is mastered and no gap is pending. */
export function isWeekComplete(
  week: RoadmapWeek,
  course: SavedCourse,
  bucket: RoadmapConceptRef[]
): boolean {
  if (week.concepts.length === 0) return bucket.length === 0;
  return (
    week.concepts.every((ref) => statusOf(course, ref) === 'mastered') && bucket.length === 0
  );
}

export interface DailySprint {
  ref: RoadmapConceptRef;
  reason: string;
  fromReviewBucket: boolean;
}

/**
 * Today's single priority: consolidate a flagged gap first, then the highest-yield
 * unfinished concept of the current week, then whatever the roadmap still owes.
 */
export function dailySprint(
  roadmap: CourseRoadmap,
  course: SavedCourse,
  weekNumber: number
): DailySprint | null {
  const bucket = reviewBucket(roadmap, course, weekNumber);
  if (bucket.length > 0) {
    return {
      ref: bucket[0],
      reason: 'ثغرة مرصودة من جلسة سابقة — نعيد تثبيتها قبل أي مفهوم جديد.',
      fromReviewBucket: true,
    };
  }

  const currentWeek = roadmap.weeks.find((w) => w.weekNumber === weekNumber);
  const pendingIn = (week: RoadmapWeek | undefined) =>
    (week?.concepts ?? []).filter((ref) => statusOf(course, ref) !== 'mastered');

  const thisWeek = pendingIn(currentWeek);
  const highYield = thisWeek.find((ref) => ref.highYield);
  if (highYield) {
    return {
      ref: highYield,
      reason: 'مفهوم عالي الوزن في أسبوعك الحالي — يستاهل جلسة اليوم.',
      fromReviewBucket: false,
    };
  }
  if (thisWeek.length > 0) {
    return {
      ref: thisWeek[0],
      reason: 'المفهوم التالي في جدول أسبوعك الحالي.',
      fromReviewBucket: false,
    };
  }

  // Current week cleared: pull the earliest concept still owed from any other week.
  for (const week of roadmap.weeks) {
    const pending = pendingIn(week);
    if (pending.length > 0) {
      return {
        ref: pending[0],
        reason:
          week.weekNumber < weekNumber
            ? `متأخر من الأسبوع ${week.weekNumber} — نخلصه اليوم.`
            : `خلّصت أسبوعك الحالي — هذي جرعة الأسبوع ${week.weekNumber} مقدماً.`,
        fromReviewBucket: false,
      };
    }
  }

  return null;
}
