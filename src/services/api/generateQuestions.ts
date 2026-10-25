/**
 * Client for the exam-model question generator:
 *   1. readExamFile        — real text of the uploaded exam (via /api/extract-slides for PDF/images)
 *   2. analyzeExam         — POST /api/generate-questions/analyze-exam: real per-topic exam counts
 *   3. generateQuestions   — POST /api/generate-questions: verified questions + per-topic coverage
 *
 * Every failure throws a typed error; nothing here substitutes canned exams or questions.
 */
import type { Concept, PracticeDifficulty, SavedCourse } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { isRateLimitError } from '../../utils/rateLimit';
import { extractSlides } from '../ai';
import { listPracticeDocuments, resolvePracticeDocuments, sourceText } from '../practiceTest';

const ANALYZE_TIMEOUT_MS = 90_000;
const GENERATE_TIMEOUT_MS = 170_000;
const MIN_EXAM_CHARS = 15;
/** Mirrors the server's caps (server/generateQuestions.ts). */
export const MAX_TOTAL_QUESTIONS = 20;
export const MAX_TOPIC_QUESTIONS = 15;

export const SUPPORTED_EXAM_ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,.md';
const TEXT_EXT = /\.(txt|md)$/i;
const PDF_EXT = /\.pdf$/i;
const IMAGE_EXT = /\.(png|jpe?g)$/i;

export type GenerateQuestionsErrorKind = 'quota' | 'network' | 'server' | 'invalid' | 'unreadable';

export class GenerateQuestionsError extends Error {
  readonly kind: GenerateQuestionsErrorKind;

  constructor(kind: GenerateQuestionsErrorKind, message: string) {
    super(message);
    this.name = 'GenerateQuestionsError';
    this.kind = kind;
  }
}

function toError(err: unknown, fallback: string): GenerateQuestionsError {
  if (err instanceof GenerateQuestionsError) return err;
  if (isRateLimitError(err)) {
    return new GenerateQuestionsError('quota', 'انتهت حصة الاستخدام الحالية. حاول مرة أخرى بعد قليل.');
  }
  // fetch() rejects with a TypeError when the request never reached the server.
  if (err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return new GenerateQuestionsError('network', 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.');
  }
  const message = err instanceof Error && err.message ? err.message : fallback;
  return new GenerateQuestionsError('server', message);
}

export interface ExamText {
  name: string;
  text: string;
  /** Set when only part of the file could be read; shown to the student, never hidden. */
  warning?: string;
}

const readAs = (file: File, mode: 'text' | 'dataUrl'): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new GenerateQuestionsError('unreadable', 'تعذرت قراءة الملف من جهازك.'));
    if (mode === 'text') reader.readAsText(file);
    else reader.readAsDataURL(file);
  });

/** Reads the real text of an uploaded exam. Throws `unreadable` when no usable text comes out. */
export async function readExamFile(file: File, concepts: Pick<Concept, 'id' | 'name'>[]): Promise<ExamText> {
  const name = file.name;
  if (TEXT_EXT.test(name)) {
    const text = (await readAs(file, 'text')).trim();
    if (text.length < MIN_EXAM_CHARS) throw new GenerateQuestionsError('unreadable', 'الملف النصي فارغ أو قصير جداً.');
    return { name, text };
  }

  const isPdf = PDF_EXT.test(name) || file.type === 'application/pdf';
  const isImage = IMAGE_EXT.test(name) || file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new GenerateQuestionsError('unreadable', 'صيغة الملف غير مدعومة. ارفع PDF أو صورة (PNG/JPG) أو ملفاً نصياً.');
  }

  const dataUrl = await readAs(file, 'dataUrl');
  const base64Data = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const mimeType = isPdf ? 'application/pdf' : file.type || 'image/jpeg';

  try {
    const source = await extractSlides({ fileName: name, rawText: '', base64Data, mimeType }, `exam-${Date.now()}`, concepts);
    const text = source.status === 'ready' || source.status === 'partial' ? sourceText(source).trim() : '';
    if (text.length < MIN_EXAM_CHARS) {
      throw new GenerateQuestionsError('unreadable', source.error || 'لم يُعثر على نص قابل للقراءة في الملف.');
    }
    return { name, text, warning: source.status === 'partial' ? source.error : undefined };
  } catch (err) {
    throw toError(err, 'تعذر استخراج نص نموذج الاختبار.');
  }
}

/** Pasted exam text, validated the same way as a file. */
export function examFromPastedText(text: string): ExamText {
  const trimmed = text.trim();
  if (trimmed.length < MIN_EXAM_CHARS) throw new GenerateQuestionsError('invalid', 'النص الملصق قصير جداً.');
  return { name: 'نص ملصق', text: trimmed };
}

export interface ExamAnalysis {
  examQuestionCount: number;
  topicCounts: Record<string, number>;
  unmappedCount: number;
}

export async function analyzeExam(course: SavedCourse, exam: ExamText): Promise<ExamAnalysis> {
  try {
    const response = await fetchWithTimeout(
      '/api/generate-questions/analyze-exam',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: course.title,
          exam: { name: exam.name, text: exam.text },
          topics: course.concepts.map((c) => ({ id: c.id, name: c.name, summary: c.summary })),
        }),
      },
      ANALYZE_TIMEOUT_MS
    );
    const data = (await response.json()) as ExamAnalysis;
    if (typeof data?.examQuestionCount !== 'number' || !data.topicCounts) {
      throw new GenerateQuestionsError('server', 'استجابة تحليل النموذج غير صالحة.');
    }
    return data;
  } catch (err) {
    throw toError(err, 'تعذر تحليل نموذج الاختبار.');
  }
}

export interface TopicQuestionRequest {
  concept: Concept;
  count: number;
  difficulty: PracticeDifficulty;
}

export interface GeneratedQuestion {
  id: number;
  topicId: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  reasoning: string;
  explanation: string;
  source: 'exam' | 'course';
  difficulty: PracticeDifficulty;
}

export interface TopicCoverage {
  topicId: string;
  requested: number;
  delivered: number;
  fromExam: number;
}

export interface GeneratedQuestionSet {
  questions: GeneratedQuestion[];
  coverage: TopicCoverage[];
  requestedTotal: number;
}

/** Text of every course document that has extracted text; empty when the course has none. */
export function courseDocuments(course: SavedCourse) {
  return resolvePracticeDocuments(
    course,
    listPracticeDocuments(course).map((d) => d.id)
  ).slice(0, 10);
}

export async function generateQuestions({
  course,
  exam,
  difficulty,
  topics,
}: {
  course: SavedCourse;
  exam: ExamText | null;
  difficulty: PracticeDifficulty;
  topics: TopicQuestionRequest[];
}): Promise<GeneratedQuestionSet> {
  const documents = courseDocuments(course);
  if (!exam && documents.length === 0) {
    throw new GenerateQuestionsError(
      'invalid',
      'لا يوجد نموذج اختبار ولا نص مستخرج من ملفات المقرر، فلا يوجد مصدر حقيقي لبناء الأسئلة منه.'
    );
  }

  try {
    const response = await fetchWithTimeout(
      '/api/generate-questions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: course.title,
          difficulty,
          exam: exam ? { name: exam.name, text: exam.text } : null,
          documents,
          topics: topics.map(({ concept, count, difficulty: d }) => ({
            id: concept.id,
            name: concept.name,
            summary: concept.summary,
            keyPrinciples: concept.keyPrinciples,
            count,
            difficulty: d,
          })),
        }),
      },
      GENERATE_TIMEOUT_MS
    );
    const data = (await response.json()) as GeneratedQuestionSet;
    if (!Array.isArray(data?.questions) || data.questions.length === 0 || !Array.isArray(data.coverage)) {
      throw new GenerateQuestionsError('server', 'لم يتمكن كواكلي من بناء أسئلة موثوقة من هذه المصادر.');
    }
    return data;
  } catch (err) {
    throw toError(err, 'فشل توليد الأسئلة.');
  }
}
