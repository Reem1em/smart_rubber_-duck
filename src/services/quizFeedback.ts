/**
 * Instant multiple-choice feedback — no model call.
 *
 * The verdict comes from `correctAnswerIndex` alone; the 1–2 sentence explanation comes
 * from the per-option note generated together with the quiz (`optionNotes`), falling back
 * to a trimmed `explanation` for quizzes generated before option notes existed.
 * Deep analysis of the student's own words belongs to the explanation sessions, not here.
 */
import type { QuizAnswerEvaluation, QuizQuestion } from '../types';

/** First `count` sentences of plain text. Text containing LaTeX is returned whole (never cut mid-formula). */
export function firstSentences(text: string, count = 2): string {
  const t = (text || '').trim();
  if (!t || t.includes('$')) return t;
  const parts = t.split(/(?<=[.!?؟])\s+/);
  return parts.slice(0, count).join(' ');
}

export function quickQuizFeedback(question: QuizQuestion, selectedIndex: number): QuizAnswerEvaluation {
  const isCorrect = selectedIndex === question.correctAnswerIndex;
  const notes = question.optionNotes;
  const note =
    Array.isArray(notes) && notes.length === question.options.length && typeof notes[selectedIndex] === 'string'
      ? notes[selectedIndex].trim()
      : '';

  if (note) return { status: isCorrect ? 'correct' : 'incorrect', explanation: firstSentences(note) };

  const reference = firstSentences(question.explanation, isCorrect ? 2 : 1);
  const correctLetter = String.fromCharCode(65 + question.correctAnswerIndex);
  return isCorrect
    ? { status: 'correct', explanation: reference }
    : {
        status: 'incorrect',
        explanation: `الإجابة الصحيحة هي الخيار ${correctLetter}.${reference ? ` ${reference}` : ''}`,
      };
}
