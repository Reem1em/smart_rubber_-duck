/**
 * Request validation and answer verification for the multi-document practice test.
 * The model's `correct_answer` is only trusted when it matches one of its own options;
 * a question whose answer can't be located is dropped rather than served with a guess.
 */

export type PracticeDifficulty = 80 | 100 | 120;

export interface PracticeDocument {
  name: string;
  text: string;
  /** ISO date of the exam/assignment, used to rank conflicting sources (most recent wins). */
  date?: string;
}

export interface PracticeTestRequest {
  subjectId: string;
  difficulty: PracticeDifficulty;
  questionCount: number;
  documents: PracticeDocument[];
}

export interface PracticeQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  /** The model's worked solution, shown after the student answers. */
  reasoning: string;
  explanation: string;
  sourceDocument: string;
  /** Concept the question tests; groups the score breakdown. */
  topic: string;
}

export const MAX_DOCUMENTS = 10;
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 20;
export const DEFAULT_QUESTIONS = 10;
const MIN_DOCUMENT_CHARS = 15;
const MAX_NAME = 120;
const MAX_SUBJECT_ID = 128;
const OPTION_COUNT = 4;

export const DIFFICULTIES: readonly PracticeDifficulty[] = [80, 100, 120];

const oneLine = (raw: unknown, max: number): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Validates the request body; returns an Arabic error message for the student on bad input. */
export function parsePracticeTestRequest(body: unknown): { request: PracticeTestRequest } | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const subjectId = oneLine(b.subjectId, MAX_SUBJECT_ID);
  if (!subjectId) return { error: 'معرّف المادة مطلوب.' };

  const difficulty = Number(b.difficulty ?? 100);
  if (!DIFFICULTIES.includes(difficulty as PracticeDifficulty)) {
    return { error: 'مستوى الصعوبة يجب أن يكون 80 أو 100 أو 120.' };
  }

  const rawCount = b.questionCount === undefined ? DEFAULT_QUESTIONS : Number(b.questionCount);
  if (!Number.isInteger(rawCount) || rawCount < MIN_QUESTIONS || rawCount > MAX_QUESTIONS) {
    return { error: `عدد الأسئلة يجب أن يكون بين ${MIN_QUESTIONS} و${MAX_QUESTIONS}.` };
  }

  if (!Array.isArray(b.documents)) return { error: 'لم يتم استلام أي مستند.' };
  const documents: PracticeDocument[] = [];
  for (const [i, raw] of b.documents.entries()) {
    const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const text = typeof d.text === 'string' ? d.text.trim() : '';
    if (text.length < MIN_DOCUMENT_CHARS) continue;
    const date = typeof d.date === 'string' && !Number.isNaN(Date.parse(d.date)) ? d.date : undefined;
    documents.push({ name: oneLine(d.name, MAX_NAME) || `مستند ${i + 1}`, text, date });
  }
  if (documents.length === 0) return { error: 'المستندات المرسلة فارغة أو قصيرة جداً لبناء اختبار.' };
  if (documents.length > MAX_DOCUMENTS) return { error: `الحد الأقصى ${MAX_DOCUMENTS} مستندات في الاختبار الواحد.` };

  return { request: { subjectId, difficulty: difficulty as PracticeDifficulty, questionCount: rawCount, documents } };
}

/** Whitespace- and Unicode-form-insensitive comparison key for an option. */
export const optionKey = (s: string): string => s.normalize('NFKC').replace(/\s+/g, ' ').trim();

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Keeps only well-formed questions whose `correct_answer` is exactly one of 4 distinct options,
 * renumbers them 1..n and caps them at `limit`.
 */
export function verifyPracticeQuestions(raw: unknown, limit: number): PracticeQuestion[] {
  if (!Array.isArray(raw)) return [];
  const verified: PracticeQuestion[] = [];

  for (const item of raw) {
    if (verified.length >= limit) break;
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;

    const question = str(q.question);
    const reasoning = str(q.step_by_step_reasoning);
    const options = Array.isArray(q.options) ? q.options.map(str) : [];
    if (!question || !reasoning || options.length !== OPTION_COUNT || options.some((o) => !o)) continue;

    const keys = options.map(optionKey);
    if (new Set(keys).size !== OPTION_COUNT) continue;

    const correctAnswerIndex = keys.indexOf(optionKey(str(q.correct_answer)));
    if (correctAnswerIndex === -1) continue;

    verified.push({
      id: verified.length + 1,
      question,
      options,
      correctAnswerIndex,
      reasoning,
      explanation: str(q.explanation) || reasoning,
      sourceDocument: str(q.source_document),
      topic: str(q.topic_tag),
    });
  }

  return verified;
}
