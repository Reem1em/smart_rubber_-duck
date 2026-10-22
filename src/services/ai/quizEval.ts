import type {
  Concept,
  QuizQuestion,
  QuizAnswerEvaluation,
  QuizDiscussionMessage,
} from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

/** Only a short excerpt is needed server-side (STEM detection), so never ship the whole material. */
const MAX_MATERIAL_CONTEXT = 2000;

/**
 * Explains a student's answer to a multiple-choice question via Gemini.
 * The verdict always follows `correctAnswerIndex`; the model only supplies feedback.
 * A fallback evaluation (degraded: true) is returned on server overload.
 */
export async function evaluateQuizAnswer(
  question: QuizQuestion,
  studentAnswerIndex: number,
  concept: Concept,
  materialContext?: string
): Promise<QuizAnswerEvaluation> {
  const response = await fetchWithTimeout('/api/quiz/evaluate-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      studentAnswerIndex,
      concept,
      materialContext: materialContext?.slice(0, MAX_MATERIAL_CONTEXT),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'فشل في تقييم الإجابة.'), {
      status: response.status,
      isRateLimit: err.isRateLimit,
      isServerOverload: err.isServerOverload,
    });
  }

  const data: QuizAnswerEvaluation = await response.json();

  // Defensive normalization — arrays must always be arrays.
  data.correct_points = Array.isArray(data.correct_points) ? data.correct_points : [];
  data.incorrect_points = Array.isArray(data.incorrect_points) ? data.incorrect_points : [];
  data.missing_points = Array.isArray(data.missing_points) ? data.missing_points : [];

  return data;
}

/**
 * Sends a discussion message about an already-evaluated question.
 * `conversationHistory` holds the earlier turns only, not `newMessage`.
 */
export async function discussQuizAnswer(params: {
  question: QuizQuestion;
  studentAnswerIndex: number;
  concept: Concept;
  previousEvaluation: QuizAnswerEvaluation;
  conversationHistory: Pick<QuizDiscussionMessage, 'role' | 'text'>[];
  newMessage: string;
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
