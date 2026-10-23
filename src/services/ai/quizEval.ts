import type { Concept, CourseScope, QuizQuestion, QuizAnswerEvaluation, QuizDiscussionMessage } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

/**
 * Optional, student-initiated follow-up about an answered quiz question.
 * (The verdict itself is instant and local — see services/quizFeedback.ts.)
 * `conversationHistory` holds the earlier turns only, not `newMessage`.
 */
export async function discussQuizAnswer(params: {
  question: QuizQuestion;
  studentAnswerIndex: number;
  concept: Concept;
  previousEvaluation: QuizAnswerEvaluation;
  conversationHistory: Pick<QuizDiscussionMessage, 'role' | 'text'>[];
  newMessage: string;
  courseScope?: CourseScope;
}): Promise<{ reply: string; degraded?: boolean }> {
  const response = await fetchWithTimeout('/api/quiz/discuss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'فشل في إرسال الرسالة.'), {
      status: response.status,
      isRateLimit: err.isRateLimit,
      isServerOverload: err.isServerOverload,
    });
  }

  return await response.json();
}
