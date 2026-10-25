/**
 * Request validation, verification and coverage accounting for the exam-model question generator.
 *
 * Nothing here pads or invents: an exam question is only counted when its text is found in the
 * uploaded exam, a generated question is only served when its answer is one of its own options,
 * and a topic that the sources could not cover gets fewer questions, reported as a shortfall.
 */
import { DIFFICULTIES, optionKey, type PracticeDifficulty, type PracticeDocument } from './practiceTest';

export const MAX_TOPICS = 30;
export const MAX_TOPIC_QUESTIONS = 15;
export const MAX_TOTAL_QUESTIONS = 20;
export const MAX_EXAM_CHARS = 60_000;
const MAX_COURSE_DOCUMENTS = 10;
const MIN_TEXT_CHARS = 15;
const MAX_NAME = 120;
const MAX_SUBJECT = 128;
const MAX_TOPIC_TEXT = 600;
const MAX_PRINCIPLES = 8;
const OPTION_COUNT = 4;
/** Share of a quoted snippet's words that must occur in the exam for the quote to count as real. */
const QUOTE_MIN_OVERLAP = 0.6;
const QUOTE_MIN_WORDS = 3;

export interface ExamDocument {
  name: string;
  text: string;
}

export interface TopicRef {
  id: string;
  name: string;
  summary: string;
}

export interface TopicRequest extends TopicRef {
  keyPrinciples: string[];
  count: number;
  difficulty: PracticeDifficulty;
}

export interface AnalyzeExamRequest {
  subjectId: string;
  exam: ExamDocument;
  topics: TopicRef[];
}

export interface ExamAnalysis {
  /** Distinct exam questions found in the uploaded text. */
  examQuestionCount: number;
  /** Exam questions per course topic id; topics the exam never asks about are 0. */
  topicCounts: Record<string, number>;
  /** Exam questions that test none of the course topics. */
  unmappedCount: number;
}

export interface GenerateQuestionsRequest {
  subjectId: string;
  exam: ExamDocument | null;
  documents: PracticeDocument[];
  topics: TopicRequest[];
}

export type QuestionSource = 'exam' | 'course';

export interface GeneratedQuestion {
  id: number;
  topicId: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  reasoning: string;
  explanation: string;
  /** 'exam' only when the question is adapted from a passage verified to exist in the uploaded exam. */
  source: QuestionSource;
  difficulty: PracticeDifficulty;
}

export interface TopicCoverage {
  topicId: string;
  requested: number;
  delivered: number;
  fromExam: number;
}

const oneLine = (raw: unknown, max: number): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const asRecord = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;

function parseExam(raw: unknown): ExamDocument | null {
  const e = asRecord(raw);
  const text = typeof e.text === 'string' ? e.text.trim() : '';
  if (text.length < MIN_TEXT_CHARS) return null;
  return { name: oneLine(e.name, MAX_NAME) || 'نموذج الاختبار', text: text.slice(0, MAX_EXAM_CHARS) };
}

function parseTopicRef(raw: unknown): TopicRef | null {
  const t = asRecord(raw);
  const id = oneLine(t.id, MAX_NAME);
  const name = oneLine(t.name, MAX_NAME);
  if (!id || !name) return null;
  return { id, name, summary: oneLine(t.summary, MAX_TOPIC_TEXT) };
}

function parseTopicRefs(raw: unknown): TopicRef[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'لم يتم تحديد أي موضوع من المقرر.' };
  if (raw.length > MAX_TOPICS) return { error: `الحد الأقصى ${MAX_TOPICS} موضوعاً في الطلب الواحد.` };
  const topics: TopicRef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = parseTopicRef(item);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    topics.push(t);
  }
  return topics.length ? topics : { error: 'مواضيع المقرر المرسلة غير صالحة.' };
}

export function parseAnalyzeExamRequest(body: unknown): { request: AnalyzeExamRequest } | { error: string } {
  const b = asRecord(body);
  const subjectId = oneLine(b.subjectId, MAX_SUBJECT);
  if (!subjectId) return { error: 'معرّف المادة مطلوب.' };
  const exam = parseExam(b.exam);
  if (!exam) return { error: 'نص نموذج الاختبار فارغ أو قصير جداً لتحليله.' };
  const topics = parseTopicRefs(b.topics);
  if ('error' in topics) return topics;
  return { request: { subjectId, exam, topics } };
}

const parseDifficulty = (raw: unknown, fallback: PracticeDifficulty): PracticeDifficulty | null => {
  const d = raw === undefined || raw === null || raw === '' ? fallback : Number(raw);
  return DIFFICULTIES.includes(d as PracticeDifficulty) ? (d as PracticeDifficulty) : null;
};

export function parseGenerateQuestionsRequest(body: unknown): { request: GenerateQuestionsRequest } | { error: string } {
  const b = asRecord(body);
  const subjectId = oneLine(b.subjectId, MAX_SUBJECT);
  if (!subjectId) return { error: 'معرّف المادة مطلوب.' };

  const difficulty = parseDifficulty(b.difficulty, 100);
  if (difficulty === null) return { error: 'مستوى الصعوبة يجب أن يكون 80 أو 100 أو 120.' };

  // An exam that was sent but is unreadable is an error, never a silent switch to course-only questions.
  const exam = b.exam === undefined || b.exam === null ? null : parseExam(b.exam);
  if (b.exam !== undefined && b.exam !== null && !exam) {
    return { error: 'نص نموذج الاختبار المرسل فارغ أو غير مقروء.' };
  }

  const documents: PracticeDocument[] = [];
  for (const [i, raw] of (Array.isArray(b.documents) ? b.documents : []).entries()) {
    const d = asRecord(raw);
    const text = typeof d.text === 'string' ? d.text.trim() : '';
    if (text.length < MIN_TEXT_CHARS) continue;
    const date = typeof d.date === 'string' && !Number.isNaN(Date.parse(d.date)) ? d.date : undefined;
    documents.push({ name: oneLine(d.name, MAX_NAME) || `مستند ${i + 1}`, text, date });
  }
  if (documents.length > MAX_COURSE_DOCUMENTS) {
    return { error: `الحد الأقصى ${MAX_COURSE_DOCUMENTS} مستندات من المقرر في الطلب الواحد.` };
  }
  if (!exam && documents.length === 0) {
    return { error: 'لا يوجد نص مقروء من النموذج أو من ملفات المقرر لبناء الأسئلة منه.' };
  }

  if (!Array.isArray(b.topics) || b.topics.length === 0) return { error: 'اختر موضوعاً واحداً على الأقل.' };
  if (b.topics.length > MAX_TOPICS) return { error: `الحد الأقصى ${MAX_TOPICS} موضوعاً في الطلب الواحد.` };

  const topics: TopicRequest[] = [];
  const seen = new Set<string>();
  for (const raw of b.topics) {
    const ref = parseTopicRef(raw);
    if (!ref || seen.has(ref.id)) continue;
    const t = asRecord(raw);
    const count = Number(t.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_TOPIC_QUESTIONS) {
      return { error: `عدد أسئلة كل موضوع يجب أن يكون بين 1 و${MAX_TOPIC_QUESTIONS}.` };
    }
    const topicDifficulty = parseDifficulty(t.difficulty, difficulty);
    if (topicDifficulty === null) return { error: 'مستوى صعوبة أحد المواضيع غير صالح.' };
    const keyPrinciples = (Array.isArray(t.keyPrinciples) ? t.keyPrinciples : [])
      .map((p) => oneLine(p, MAX_TOPIC_TEXT))
      .filter(Boolean)
      .slice(0, MAX_PRINCIPLES);
    seen.add(ref.id);
    topics.push({ ...ref, keyPrinciples, count, difficulty: topicDifficulty });
  }
  if (topics.length === 0) return { error: 'مواضيع المقرر المرسلة غير صالحة.' };

  const total = topics.reduce((s, t) => s + t.count, 0);
  if (total > MAX_TOTAL_QUESTIONS) {
    return { error: `الحد الأقصى ${MAX_TOTAL_QUESTIONS} سؤالاً في الاختبار الواحد (طُلب ${total}).` };
  }

  return { request: { subjectId, exam, documents, topics } };
}

/** Diacritic-, case- and punctuation-insensitive word list. */
function words(text: string): string[] {
  return text
    .normalize('NFKC')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/** Word index of a source text, for repeated quote checks against it. */
export function wordIndex(text: string): Set<string> {
  return new Set(words(text));
}

/**
 * True when `snippet` plausibly quotes the indexed text: at least QUOTE_MIN_WORDS words and
 * QUOTE_MIN_OVERLAP of them present. Tolerant of OCR spacing and reformatted math, but a
 * question the model made up shares too few words with the exam to pass.
 */
export function quotesText(snippet: string, index: Set<string>): boolean {
  const w = words(snippet);
  if (w.length < QUOTE_MIN_WORDS) return false;
  const hits = w.filter((x) => index.has(x)).length;
  return hits / w.length >= QUOTE_MIN_OVERLAP;
}

const questionKey = (s: string): string => words(s).join(' ');

/**
 * Counts the exam questions the model located, keeping only those whose text is found in the
 * exam. A topic id the request didn't contain counts as unmapped, not as a topic.
 */
export function verifyExamAnalysis(raw: unknown, exam: ExamDocument, topics: TopicRef[]): ExamAnalysis {
  const index = wordIndex(exam.text);
  const topicCounts: Record<string, number> = Object.fromEntries(topics.map((t) => [t.id, 0]));
  const seen = new Set<string>();
  let examQuestionCount = 0;
  let unmappedCount = 0;

  for (const item of Array.isArray(raw) ? raw : []) {
    const q = asRecord(item);
    const text = str(q.text);
    if (!quotesText(text, index)) continue;
    const key = questionKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    examQuestionCount++;
    const topicId = str(q.topic_id);
    if (topicId in topicCounts) topicCounts[topicId]++;
    else unmappedCount++;
  }

  return { examQuestionCount, topicCounts, unmappedCount };
}

/**
 * Keeps only well-formed questions whose `correct_answer` is exactly one of 4 distinct options,
 * that belong to a requested topic, aren't duplicates, and fit the topic's requested count.
 * A question claiming `source: 'exam'` keeps that label only when its excerpt is found in the exam.
 */
export function verifyGeneratedQuestions(
  raw: unknown,
  topics: TopicRequest[],
  exam: ExamDocument | null
): { questions: GeneratedQuestion[]; coverage: TopicCoverage[] } {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const coverage = new Map<string, TopicCoverage>(
    topics.map((t) => [t.id, { topicId: t.id, requested: t.count, delivered: 0, fromExam: 0 }])
  );
  const examIndex = exam ? wordIndex(exam.text) : null;
  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    const q = asRecord(item);
    const topic = byId.get(str(q.topic_id));
    const cov = topic && coverage.get(topic.id);
    if (!topic || !cov || cov.delivered >= cov.requested) continue;

    const question = str(q.question);
    const reasoning = str(q.step_by_step_reasoning);
    const options = Array.isArray(q.options) ? q.options.map(str) : [];
    if (!question || !reasoning || options.length !== OPTION_COUNT || options.some((o) => !o)) continue;

    const keys = options.map(optionKey);
    if (new Set(keys).size !== OPTION_COUNT) continue;
    const correctAnswerIndex = keys.indexOf(optionKey(str(q.correct_answer)));
    if (correctAnswerIndex === -1) continue;

    const key = questionKey(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const fromExam = str(q.source) === 'exam' && examIndex !== null && quotesText(str(q.exam_excerpt), examIndex);
    cov.delivered++;
    if (fromExam) cov.fromExam++;

    questions.push({
      id: questions.length + 1,
      topicId: topic.id,
      question,
      options,
      correctAnswerIndex,
      reasoning,
      explanation: str(q.explanation) || reasoning,
      source: fromExam ? 'exam' : 'course',
      difficulty: topic.difficulty,
    });
  }

  return { questions, coverage: topics.map((t) => coverage.get(t.id)!) };
}
