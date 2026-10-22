import { Type } from '@google/genai';

/**
 * Structured output schema for a detailed quiz answer evaluation.
 * Maps to QuizAnswerEvaluation in src/types.ts
 */
export const quizEvalSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ['correct', 'partially_correct', 'incorrect', 'needs_clarification'],
      description:
        'الحكم العام: correct | partially_correct | incorrect | needs_clarification',
    },
    overall_assessment: {
      type: Type.STRING,
      description: 'ملخص عربي موجز للحكم (جملة أو جملتان)',
    },
    correct_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'ما أصاب فيه الطالب، يمكن أن يكون فارغاً',
    },
    incorrect_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'الأخطاء المفاهيمية أو الحسابية التي ارتكبها الطالب',
    },
    missing_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'معلومات أو منطق ناقص كان ينبغي توافره',
    },
    explanation: {
      type: Type.STRING,
      description: 'شرح أكاديمي دقيق للمفهوم المختبر في هذا السؤال',
    },
    suggested_correction: {
      type: Type.STRING,
      description: 'التصحيح أو الخطوة التالية المقترحة للطالب',
    },
    needs_clarification: {
      type: Type.BOOLEAN,
      description:
        'true فقط إذا كان السؤال أو الخيارات غامضة تمنع التقييم العادل',
    },
  },
  required: [
    'status',
    'overall_assessment',
    'correct_points',
    'incorrect_points',
    'missing_points',
    'explanation',
    'suggested_correction',
    'needs_clarification',
  ],
};

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

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];

const toText = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Coerces a model evaluation into the client shape. The verdict is taken from the
 * answer key, never from the model: a multiple-choice grade is deterministic. The only
 * model verdict kept is `needs_clarification`, which flags an ambiguous question.
 */
export function normalizeQuizEvaluation(parsed: any, isCorrect: boolean) {
  const needsClarification = parsed?.status === 'needs_clarification' || parsed?.needs_clarification === true;
  return {
    status: needsClarification ? 'needs_clarification' : isCorrect ? 'correct' : 'incorrect',
    overall_assessment: toText(parsed?.overall_assessment),
    correct_points: toStringArray(parsed?.correct_points),
    incorrect_points: toStringArray(parsed?.incorrect_points),
    missing_points: toStringArray(parsed?.missing_points),
    explanation: toText(parsed?.explanation),
    suggested_correction: toText(parsed?.suggested_correction),
    needs_clarification: needsClarification,
  };
}

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
