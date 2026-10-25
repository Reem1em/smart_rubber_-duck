/**
 * Pure helpers for the practice-test workspace: which course documents can feed a test,
 * turning the student's selection into document text, and scoring a finished attempt.
 */
import type { PracticeDocument, PracticeQuestion, SavedCourse, SlideSource } from '../types';

/** A course document the student can tick in the setup panel. */
export interface PracticeDocumentOption {
  /** SlideSource.sourceId: the course id for the primary material, CourseFile.id for chapters. */
  id: string;
  name: string;
  /** Upload time (ms since epoch). */
  uploadedAt: number;
  /** Original file size in bytes. */
  fileSize: number;
  /** Characters of extracted text available for the test. */
  textLength: number;
  /** Part of the file could not be read, so the test may miss some of it. */
  partial: boolean;
}

/** Plain text of one extracted file: every slide's heading, text and visual description, in order. */
export function sourceText(source: SlideSource): string {
  return source.chunks
    .map((c) => [c.part === 1 ? c.heading : '', c.text, c.visual ?? ''].filter((s) => s.trim()).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Documents with usable extracted text, newest first. A course created from pasted text has
 * no slide sources; its raw text stands in as the primary document.
 */
export function listPracticeDocuments(course: SavedCourse): PracticeDocumentOption[] {
  const fileById = new Map((course.files ?? []).map((f) => [f.id, f]));
  const options: PracticeDocumentOption[] = [];

  for (const source of course.slideSources ?? []) {
    if (source.status !== 'ready' && source.status !== 'partial') continue;
    const textLength = sourceText(source).length;
    if (textLength === 0) continue;
    const file = fileById.get(source.sourceId);
    const isPrimary = source.sourceId === course.id;
    if (!file && !isPrimary) continue;
    options.push({
      id: source.sourceId,
      name: source.fileName,
      uploadedAt: file?.uploadedAt ?? course.createdAt,
      fileSize: file?.fileSize ?? course.fileSize,
      textLength,
      partial: source.status === 'partial',
    });
  }

  const rawText = course.material.rawText?.trim();
  if (rawText && !options.some((o) => o.id === course.id)) {
    options.push({
      id: course.id,
      name: course.fileName,
      uploadedAt: course.createdAt,
      fileSize: course.fileSize,
      textLength: rawText.length,
      partial: false,
    });
  }

  return options.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/** Resolves selected document ids to the text payload the backend expects; unknown ids are skipped. */
export function resolvePracticeDocuments(course: SavedCourse, documentIds: string[]): PracticeDocument[] {
  const sources = new Map((course.slideSources ?? []).map((s) => [s.sourceId, s]));
  const options = new Map(listPracticeDocuments(course).map((o) => [o.id, o]));
  const documents: PracticeDocument[] = [];

  for (const id of new Set(documentIds)) {
    const option = options.get(id);
    if (!option) continue;
    const source = sources.get(id);
    const usable = source && (source.status === 'ready' || source.status === 'partial');
    const text = usable ? sourceText(source) : course.material.rawText?.trim() ?? '';
    if (!text) continue;
    documents.push({ name: option.name, text, date: new Date(option.uploadedAt).toISOString() });
  }

  return documents;
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
}

export interface PracticeScore {
  correct: number;
  answered: number;
  total: number;
  /** Rounded 0-100. */
  percent: number;
  /** Weakest topics first, so the review starts where the student struggled. */
  byTopic: TopicScore[];
}

/** Topic label for questions the model didn't tag. */
export const UNTAGGED_TOPIC = 'عام';

/** `answers[i]` is the chosen option index for `questions[i]`, or null when skipped. */
export function scorePracticeTest(questions: PracticeQuestion[], answers: Array<number | null>): PracticeScore {
  const topics = new Map<string, TopicScore>();
  let correct = 0;
  let answered = 0;

  questions.forEach((q, i) => {
    const choice = answers[i] ?? null;
    const isCorrect = choice === q.correctAnswerIndex;
    if (choice !== null) answered++;
    if (isCorrect) correct++;
    const topic = q.topic.trim() || UNTAGGED_TOPIC;
    const entry = topics.get(topic) ?? { topic, correct: 0, total: 0 };
    entry.total++;
    if (isCorrect) entry.correct++;
    topics.set(topic, entry);
  });

  const byTopic = [...topics.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
  const total = questions.length;
  return { correct, answered, total, percent: total ? Math.round((correct / total) * 100) : 0, byTopic };
}
