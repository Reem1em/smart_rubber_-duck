/**
 * Pure helpers for question generation: which course documents have extracted text, and
 * turning them into the document text the backend expects.
 */
import type { PracticeDocument, SavedCourse, SlideSource } from '../types';

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
