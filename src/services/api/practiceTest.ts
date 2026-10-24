/**
 * Client for POST /api/practice-test/generate.
 *
 * The server needs document text, not ids: the selected ids are resolved against the course's
 * extracted slide text in the browser (see resolvePracticeDocuments).
 */
import type { PracticeDifficulty, PracticeTest, SavedCourse } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { isRateLimitError } from '../../utils/rateLimit';
import { resolvePracticeDocuments } from '../practiceTest';

/** Worked solutions for up to 20 questions take longer than a quiz; matches the server's model budget. */
const PRACTICE_TEST_TIMEOUT_MS = 170_000;

export type PracticeTestErrorKind = 'quota' | 'network' | 'server' | 'invalid';

/** Typed failure so the view can open the quota modal or show the right message. */
export class PracticeTestError extends Error {
  readonly kind: PracticeTestErrorKind;

  constructor(kind: PracticeTestErrorKind, message: string) {
    super(message);
    this.name = 'PracticeTestError';
    this.kind = kind;
  }
}

export interface GeneratePracticeTestPayload {
  course: SavedCourse;
  difficultyLevel: PracticeDifficulty;
  questionCount: number;
  documentIds: string[];
}

function toPracticeTestError(err: unknown): PracticeTestError {
  if (err instanceof PracticeTestError) return err;
  if (isRateLimitError(err)) {
    return new PracticeTestError('quota', 'انتهت حصة الاستخدام الحالية. حاول مرة أخرى بعد قليل.');
  }
  // fetch() rejects with a TypeError when the request never reached the server.
  if (err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return new PracticeTestError('network', 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.');
  }
  const message = err instanceof Error && err.message ? err.message : 'فشل في إنشاء الاختبار التدريبي.';
  return new PracticeTestError('server', message);
}

export async function generatePracticeTest({
  course,
  difficultyLevel,
  questionCount,
  documentIds,
}: GeneratePracticeTestPayload): Promise<PracticeTest> {
  const documents = resolvePracticeDocuments(course, documentIds);
  if (documents.length === 0) {
    throw new PracticeTestError('invalid', 'اختر مستنداً واحداً على الأقل يحتوي على نص مستخرج.');
  }

  try {
    const response = await fetchWithTimeout(
      '/api/practice-test/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The course title, not its hash id: the prompt uses it as subject context.
        body: JSON.stringify({ subjectId: course.title, documents, difficulty: difficultyLevel, questionCount }),
      },
      PRACTICE_TEST_TIMEOUT_MS
    );
    const data = (await response.json()) as PracticeTest;
    if (!Array.isArray(data?.questions) || data.questions.length === 0) {
      throw new PracticeTestError('server', 'لم يتمكن كواكلي من بناء أسئلة موثوقة من هذه المستندات.');
    }
    return data;
  } catch (err) {
    throw toPracticeTestError(err);
  }
}
