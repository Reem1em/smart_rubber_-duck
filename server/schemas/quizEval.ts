import { Type } from '@google/genai';

/**
 * Schema for a discussion follow-up reply (plain text with LaTeX).
 * The discussion explains; it never re-grades — the grade is fixed by correctAnswerIndex.
 */
export const quizDiscussionSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'رد كواكلي على رسالة الطالب، باللغة العربية مع LaTeX عند الحاجة',
    },
  },
  required: ['reply'],
};

export const MAX_DISCUSSION_TEXT = 1000;
const MAX_HISTORY_TURNS = 12;

const toText = (value: unknown): string => (typeof value === 'string' ? value : '');

export interface ValidQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

const isIndexIn = (value: unknown, length: number): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < length;

/** Validates the shared question + answer part of both quiz-eval bodies. */
export function validateQuizAnswerBody(
  body: any
): { ok: true; question: ValidQuizQuestion; studentAnswerIndex: number } | { ok: false } {
  const q = body?.question;
  const options = Array.isArray(q?.options) ? q.options.filter((o: unknown) => typeof o === 'string') : [];
  if (
    typeof q?.question !== 'string' ||
    !q.question.trim() ||
    options.length < 2 ||
    options.length !== q.options.length ||
    !isIndexIn(q.correctAnswerIndex, options.length) ||
    !isIndexIn(body?.studentAnswerIndex, options.length)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    question: {
      question: q.question,
      options,
      correctAnswerIndex: q.correctAnswerIndex,
      explanation: toText(q.explanation),
    },
    studentAnswerIndex: body.studentAnswerIndex,
  };
}

/** Validates and trims the student's discussion message and history. */
export function sanitizeDiscussion(body: any):
  | { ok: true; newMessage: string; history: Array<{ role: 'student' | 'tutor'; text: string }> }
  | { ok: false } {
  const newMessage = typeof body?.newMessage === 'string' ? body.newMessage.trim() : '';
  if (!newMessage) return { ok: false };

  const history = Array.isArray(body?.conversationHistory)
    ? body.conversationHistory
        .filter((m: any) => (m?.role === 'student' || m?.role === 'tutor') && typeof m?.text === 'string')
        .map((m: any) => ({ role: m.role as 'student' | 'tutor', text: m.text.slice(0, MAX_DISCUSSION_TEXT) }))
        .slice(-MAX_HISTORY_TURNS)
    : [];

  return { ok: true, newMessage: newMessage.slice(0, MAX_DISCUSSION_TEXT), history };
}
