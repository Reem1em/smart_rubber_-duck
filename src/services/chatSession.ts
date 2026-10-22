/**
 * Course-scoped request building for the tutor chat ("اسأل كواكلي").
 *
 * Every piece of context sent to the model — history, focus concept, slide excerpts,
 * concept summaries — is derived from ONE course and dropped when it does not belong to
 * it. This is enforced here in application code, not left to the prompt.
 *
 * Pure module so the isolation rules are unit-testable without React.
 */
import type { Concept, CourseChatMessage, SavedCourse } from '../types';
import type { CourseChatRequest } from './ai/courseChat';
import { expectedSourcesFor, retrieveExcerpts } from './slides/retrieval';

export const CHAT_HISTORY_TURNS = 6;

/** A transcript together with the course it was loaded for. */
export interface ChatThreadState {
  /** null while the thread for the active course is still loading. */
  courseId: string | null;
  messages: CourseChatMessage[];
}

/** True only when the thread in memory was loaded for `courseId`. */
export function isThreadFor(thread: ChatThreadState, courseId: string | null): boolean {
  return !!courseId && thread.courseId === courseId;
}

/**
 * Appends a message to the in-memory thread only if that thread still belongs to
 * `forCourseId`. A reply that arrives after the student switched courses is dropped
 * from the view (it is still persisted under its own course by the caller).
 */
export function appendToThread(
  thread: ChatThreadState,
  forCourseId: string,
  message: CourseChatMessage
): ChatThreadState {
  return thread.courseId === forCourseId ? { ...thread, messages: [...thread.messages, message] } : thread;
}

/** The focus concept, only if it actually belongs to this course. */
export function conceptInCourse(course: Pick<SavedCourse, 'concepts'>, concept: Concept | null): Concept | null {
  if (!concept) return null;
  return course.concepts.some((c) => c.id === concept.id) ? concept : null;
}

/**
 * Builds the chat request for `course`. History is used only when `thread` was loaded
 * for this same course; otherwise the request goes out with no history rather than
 * another course's transcript.
 */
export function buildCourseChatRequest({
  course,
  thread,
  message,
  concept,
}: {
  course: SavedCourse;
  thread: ChatThreadState;
  message: string;
  concept: Concept | null;
}): CourseChatRequest {
  const priorTurns = isThreadFor(thread, course.id) ? thread.messages.slice(-CHAT_HISTORY_TURNS) : [];
  const focus = conceptInCourse(course, concept);

  const retrieval = retrieveExcerpts({
    expectedSources: expectedSourcesFor(course),
    slideSources: course.slideSources,
    concepts: course.concepts,
    message,
    priorStudentTurns: priorTurns.filter((m) => m.role === 'student').map((m) => m.text),
    focusConcept: focus ? { id: focus.id, name: focus.name, keyPrinciples: focus.keyPrinciples } : undefined,
  });

  return {
    courseId: course.id,
    courseTitle: course.title,
    conceptNames: course.concepts.map((c) => c.name),
    message,
    focusConcept: focus ? { name: focus.name, summary: focus.summary, keyPrinciples: focus.keyPrinciples } : undefined,
    history: priorTurns.map(({ role, text }) => ({ role, text })),
    excerpts: retrieval.excerpts,
    grounding: retrieval.grounding,
    unavailableSources: retrieval.unavailableSources,
    summaries: retrieval.summaries,
  };
}

export type ChatVerdict = 'correct' | 'incorrect' | 'partial' | 'unclear';

const VERDICT_MARKS: Array<[ChatVerdict, RegExp]> = [
  ['correct', /✅/],
  ['incorrect', /❌/],
  ['partial', /⚠️?/],
  ['unclear', /❓/],
];

/**
 * Verdict marks the tutor put at the start of its claim lines (✅ ❌ ⚠️ ❓), in order of
 * first appearance. Marks elsewhere in a sentence are ignored. Empty when the reply did not
 * evaluate a claim (greeting, plain question).
 */
export function extractVerdicts(reply: string): ChatVerdict[] {
  const found: ChatVerdict[] = [];
  for (const rawLine of reply.split('\n')) {
    const line = rawLine.replace(/^[\s\-•*·\d.)]+/, '');
    for (const [verdict, mark] of VERDICT_MARKS) {
      if (line.search(mark) === 0 && !found.includes(verdict)) found.push(verdict);
    }
  }
  return found;
}
