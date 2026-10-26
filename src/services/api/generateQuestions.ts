/**
 * The single question-generation service ("ولّد أسئلة"):
 *   1. readExamFile / readPastedExam — real text of an exam model via /api/extract-slides
 *   2. analyzeExam                   — POST /api/generate-questions/analyze-exam: real per-topic counts
 *   3. generateQuestions             — POST /api/generate-questions: verified questions + coverage
 *
 * Every failure throws a typed error with what was tried; nothing here substitutes canned
 * exams or questions.
 */
import type { Concept, PracticeDifficulty, SavedCourse, SlideSource } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { isRateLimitError } from '../../utils/rateLimit';
import { UploadError, readUpload, type UploadKind } from '../../utils/uploadFile';
import { extractSlides } from '../ai/extractSlides';
import { hashContent } from '../courseStore';
import { listPracticeDocuments, resolvePracticeDocuments, sourceText } from '../practiceTest';

const ANALYZE_TIMEOUT_MS = 90_000;
const GENERATE_TIMEOUT_MS = 170_000;
const MIN_EXAM_CHARS = 15;
const MAX_COURSE_DOCUMENTS = 10;
/** Mirrors the server's caps (server/generateQuestions.ts). */
export const MAX_TOTAL_QUESTIONS = 20;
export const MAX_TOPIC_QUESTIONS = 15;

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
  if (err instanceof UploadError) return new GenerateQuestionsError('unreadable', err.message);
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

/** What was attempted per file type, so an empty result is never a bare "no text". */
const ATTEMPTED: Record<UploadKind | 'pasted', string> = {
  pdf: 'قراءة ملف PDF واستخراج نصه بالتعرف الضوئي',
  image: 'استخراج النص من الصورة بالتعرف الضوئي',
  docx: 'تحويل ملف Word ‎(.docx) إلى نص',
  text: 'قراءة الملف النصي بترميز UTF-8',
  pasted: 'تقسيم النص الملصق',
};

/** An exam model whose text was actually extracted, with the stored-file identity it will get. */
export interface ExamText {
  /** SHA-256 of the file (or pasted text): the CourseFile id it is stored under. */
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  text: string;
  /** The extraction result, stored on the course so the exam is a real course file. */
  source: SlideSource;
  /** Set when only part of the file could be read; shown to the student, never hidden. */
  warning?: string;
}

async function extractExam(
  fileId: string,
  name: string,
  size: number,
  kind: UploadKind | 'pasted',
  material: { rawText?: string; base64Data?: string; mimeType?: string },
  concepts: Pick<Concept, 'id' | 'name'>[]
): Promise<ExamText> {
  let source: SlideSource;
  try {
    source = await extractSlides(
      { fileName: name, rawText: material.rawText ?? '', base64Data: material.base64Data, mimeType: material.mimeType },
      fileId,
      concepts
    );
  } catch (err) {
    throw toError(err, `تعذر استخراج نص "${name}".`);
  }

  const usable = source.status === 'ready' || source.status === 'partial';
  const text = usable ? sourceText(source).trim() : '';
  if (text.length < MIN_EXAM_CHARS) {
    const reason = source.error || 'لم يُنتج الاستخراج نصاً قابلاً للقراءة.';
    throw new GenerateQuestionsError('unreadable', `جرّبنا ${ATTEMPTED[kind]} للملف "${name}": ${reason}`);
  }
  return {
    fileId,
    name,
    size,
    mimeType: material.mimeType || 'text/plain',
    text,
    source,
    warning: source.status === 'partial' ? source.error : undefined,
  };
}

/** Reads the real text of an uploaded exam file. Throws `unreadable` with what was tried. */
export async function readExamFile(file: File, concepts: Pick<Concept, 'id' | 'name'>[]): Promise<ExamText> {
  try {
    const material = await readUpload(file);
    const fileId = await hashContent(await file.arrayBuffer());
    return await extractExam(fileId, file.name, file.size, material.kind, material, concepts);
  } catch (err) {
    throw toError(err, `تعذرت قراءة الملف "${file.name}".`);
  }
}

/** Pasted exam text, stored like a text file so it gets a real file id. */
export async function readPastedExam(text: string, concepts: Pick<Concept, 'id' | 'name'>[]): Promise<ExamText> {
  const trimmed = text.trim();
  if (trimmed.length < MIN_EXAM_CHARS) throw new GenerateQuestionsError('invalid', 'النص الملصق قصير جداً.');
  const fileId = await hashContent(trimmed);
  const name = `نموذج ملصق (${new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date())})`;
  return extractExam(fileId, name, new TextEncoder().encode(trimmed).length, 'pasted', { rawText: trimmed }, concepts);
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

/* ------------------------------------------------------------------ */
/* Provenance                                                           */
/* ------------------------------------------------------------------ */

/**
 * - uploaded_exam: adapted from a question verified to exist in a stored, parsed exam file
 * - mixed:         an exam question combined with material from the course files
 * - generated:     built from the course files only (or exam origin could not be verified)
 */
export type QuestionProvenance = 'uploaded_exam' | 'mixed' | 'generated';

export const PROVENANCE_LABEL: Record<QuestionProvenance, string> = {
  uploaded_exam: 'من نموذجك المرفوع',
  mixed: 'من نموذجك + ملفات المقرر',
  generated: 'مولّد من ملفات المقرر',
};

/** A stored exam file whose text was really extracted. */
export function isParsedExamFile(course: SavedCourse, fileId: string | undefined): boolean {
  if (!fileId) return false;
  const file = (course.files ?? []).find((f) => f.id === fileId);
  const source = (course.slideSources ?? []).find((s) => s.sourceId === fileId);
  return (
    file?.kind === 'exam' &&
    !!source &&
    (source.status === 'ready' || source.status === 'partial') &&
    sourceText(source).trim().length > 0
  );
}

/**
 * The provenance shown to the student. An exam label survives only if the server verified the
 * exam excerpt AND `sourceFileId` names an exam file stored on this course with parsed text.
 */
export function verifiedProvenance(
  q: Pick<GeneratedQuestion, 'source' | 'sourceFileId'>,
  course: SavedCourse
): QuestionProvenance {
  if (q.source === 'generated') return 'generated';
  return isParsedExamFile(course, q.sourceFileId) ? q.source : 'generated';
}

/* ------------------------------------------------------------------ */
/* Generation                                                           */
/* ------------------------------------------------------------------ */

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
  source: QuestionProvenance;
  sourceFileId?: string;
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

/** Text of the course's study files (not stored exam models); empty when none has text yet. */
export function courseDocuments(course: SavedCourse) {
  const examIds = new Set((course.files ?? []).filter((f) => f.kind === 'exam').map((f) => f.id));
  const ids = listPracticeDocuments(course)
    .map((d) => d.id)
    .filter((id) => !examIds.has(id));
  return resolvePracticeDocuments(course, ids).slice(0, MAX_COURSE_DOCUMENTS);
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
          // fileId only for an exam actually stored on this course: the server echoes it as provenance.
          exam: exam
            ? { name: exam.name, text: exam.text, fileId: isParsedExamFile(course, exam.fileId) ? exam.fileId : undefined }
            : null,
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
