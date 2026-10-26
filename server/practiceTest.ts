/**
 * Shared document/difficulty types and option normalization for question generation
 * (server/generateQuestions.ts).
 */

export type PracticeDifficulty = 80 | 100 | 120;

export interface PracticeDocument {
  name: string;
  text: string;
  /** ISO date of the exam/assignment, used to rank conflicting sources (most recent wins). */
  date?: string;
}

export const DIFFICULTIES: readonly PracticeDifficulty[] = [80, 100, 120];

/** Whitespace- and Unicode-form-insensitive comparison key for an option. */
export const optionKey = (s: string): string => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
