import { PracticeDifficulty, PracticeDocument, PracticeTest } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

/** Builds a practice test from several uploaded exams/assignments at the given difficulty. */
export async function generatePracticeTest(
  subjectId: string,
  documents: PracticeDocument[],
  difficulty: PracticeDifficulty = 100,
  questionCount = 10
): Promise<PracticeTest> {
  const response = await fetchWithTimeout('/api/practice-test/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjectId, documents, difficulty, questionCount }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'فشل في إنشاء الاختبار التدريبي.');
  }

  return await response.json();
}
