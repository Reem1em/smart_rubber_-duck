/**
 * Course-level isolation for every concept-session AI call (explanation, Socratic follow-up,
 * quiz generation/discussion, final report).
 *
 * The client sends `courseScope: { courseId, courseTitle, conceptNames }`. When the signed-in
 * user has a server copy of that course, the server copy's title and concepts win over the
 * client's claim. The resolved scope is then rendered as a prompt block that confines the model
 * to that one course, so math, programming and other subjects never bleed into each other.
 */
import type { Request } from 'express';

import { bearerToken, verifySession } from './auth/session';
import { getUserCourse } from './auth/courseStore';

export interface CourseScope {
  courseId: string;
  courseTitle: string;
  conceptNames: string[];
}

/** `error` means a malformed scope (answer 400); otherwise `scope` is null only for legacy unscoped calls. */
export type CourseScopeResult = { scope: CourseScope | null } | { error: string };

const COURSE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_TITLE = 200;
const MAX_CONCEPT_NAME = 120;
const MAX_CONCEPTS = 60;

export const INVALID_COURSE_SCOPE = 'معرّف المادة غير صالح.';

/** One line, length-capped: keeps student-supplied names from smuggling prompt structure. */
const oneLine = (raw: unknown, max: number): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const cleanNames = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? [...new Set(raw.map((n) => oneLine(n, MAX_CONCEPT_NAME)).filter(Boolean))].slice(0, MAX_CONCEPTS)
    : [];

/** Validates the client's course scope. Absent scope is allowed (legacy clients) and yields null. */
export function parseCourseScope(raw: unknown): CourseScopeResult {
  if (raw === undefined || raw === null) return { scope: null };
  const body = raw as Record<string, unknown>;
  if (typeof body !== 'object' || typeof body.courseId !== 'string' || !COURSE_ID_PATTERN.test(body.courseId)) {
    return { error: INVALID_COURSE_SCOPE };
  }
  return {
    scope: {
      courseId: body.courseId,
      courseTitle: oneLine(body.courseTitle, MAX_TITLE) || 'المادة الدراسية',
      conceptNames: cleanNames(body.conceptNames),
    },
  };
}

/**
 * Parses the client's scope (default `req.body.courseScope`), then prefers the signed-in user's
 * server copy of the course. Routes with a different wire shape (the chat) pass `raw` themselves.
 */
export async function resolveCourseScope(req: Request, raw: unknown = req.body?.courseScope): Promise<CourseScopeResult> {
  const parsed = parseCourseScope(raw);
  if ('error' in parsed || !parsed.scope) return parsed;

  const sub = verifySession(bearerToken(req.headers.authorization));
  if (!sub) return parsed;

  const serverCourse = await getUserCourse(sub, parsed.scope.courseId).catch(() => undefined);
  if (!serverCourse) return parsed;

  const serverNames = cleanNames(
    serverCourse.concepts.map((c) => (c && typeof c === 'object' ? (c as { name?: unknown }).name : undefined))
  );
  return {
    scope: {
      courseId: parsed.scope.courseId,
      courseTitle: oneLine(serverCourse.title, MAX_TITLE) || parsed.scope.courseTitle,
      // Chapters added moments ago may not be synced yet, so merge rather than replace.
      conceptNames: [...new Set([...serverNames, ...parsed.scope.conceptNames])].slice(0, MAX_CONCEPTS),
    },
  };
}

/** Text that only describes the course, for subject detection (never the whole material). */
export const scopeSubjectText = (scope: CourseScope | null): string[] =>
  scope ? [scope.courseTitle] : [];

/** Verbatim mandate injected into every course-bound prompt (concept sessions, chat, labs). */
export const ZERO_HALLUCINATION_MANDATE =
  'ZERO-HALLUCINATION MANDATE: Restrict outputs 100% strictly to the active course scope and extracted concepts. Drawing examples or questions from other subjects or past session context is strictly prohibited.';

const conceptList = (scope: CourseScope): string =>
  scope.conceptNames.length ? scope.conceptNames.join('، ') : '(غير محددة)';

/** Prompt block that pins the model to one course. Always returns a rule, even without a scope. */
export function buildCourseScopeBlock(scope: CourseScope | null, conceptName: string): string {
  const rules = `${ZERO_HALLUCINATION_MANDATE}
قواعد عزل المقرر (إلزامية):
- التزم حصراً بمادة هذا المقرر والمفهوم "${oneLine(conceptName, MAX_CONCEPT_NAME)}". لا تستورد أمثلة أو مصطلحات أو رموزاً من مقررات أو تخصصات أخرى (لا مصفوفات أو تكاملات في مقرر برمجة، ولا شيفرة برمجية في مقرر رياضيات) ما لم تكن جزءاً من هذا المقرر نفسه.
- لا تعتمد على أي جلسة أو محادثة سابقة أو مقرر آخر؛ السياق المرفق في هذا الطلب هو المرجع الوحيد.
- لا تخترع مفاهيم أو حقائق ليست من هذا المقرر؛ إن لم تكن متأكداً فقل ذلك صراحة.
- إن خرج كلام الطالب عن المقرر فأعده بلطف إلى المفهوم الحالي.`;

  if (!scope) return rules;

  return `--- نطاق المقرر (course_id: ${scope.courseId}) ---
المقرر: "${scope.courseTitle}"
مفاهيم هذا المقرر: ${conceptList(scope)}
${rules}`;
}

/**
 * Scope block for the practical labs (code/bug/project). Labs are also reachable outside any
 * course, so without a scope this returns '' and the lab stays a general programming tool.
 */
export function buildLabScopeBlock(scope: CourseScope | null): string {
  if (!scope) return '';
  return `--- نطاق المقرر (course_id: ${scope.courseId}) ---
المقرر: "${scope.courseTitle}"
مفاهيم هذا المقرر: ${conceptList(scope)}
${ZERO_HALLUCINATION_MANDATE}
قواعد عزل المقرر (إلزامية):
- ابنِ التحدي أو التقييم حصراً حول مفاهيم هذا المقرر المذكورة أعلاه؛ لغة البرمجة أداة تنفيذ فقط وليست مصدراً لمواضيع جديدة.
- يُمنع إدخال موضوعات من تخصصات أو مقررات أخرى (لا مصفوفات أو تكاملات في مقرر برمجة، ولا مواضيع برمجية خارج مفاهيم مقرر غير برمجي).
- لا تعتمد على أي تحدٍّ أو جلسة سابقة؛ هذا الطلب مستقل تماماً.`;
}
