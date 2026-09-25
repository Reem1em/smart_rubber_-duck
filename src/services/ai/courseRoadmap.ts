import { ParsedSyllabus } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export interface ParseSyllabusInput {
  /** Base64 payload of a PDF/image syllabus, without the data-url prefix. */
  base64Data?: string;
  mimeType?: string;
  /** Plain-text syllabus, used when no document is attached. */
  textContent?: string;
  /** Concept names already extracted from the course, so the weeks align with them. */
  conceptNames: string[];
  courseName?: string;
  todayIso: string;
}

/**
 * Parses an official course specification once. The caller caches the normalized
 * roadmap on the course record, so no syllabus is ever sent to the model twice.
 */
export async function parseSyllabus(input: ParseSyllabusInput): Promise<ParsedSyllabus> {
  const response = await fetchWithTimeout('/api/course-roadmap/parse-syllabus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'تعذر تحليل توصيف المادة.');
  }

  return await response.json();
}
