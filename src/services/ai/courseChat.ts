import { CourseChatMessage } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import type { ChatExcerpt, ConceptSummary, Grounding } from '../slides/retrieval';

export interface CourseChatRequest {
  courseId: string;
  courseTitle: string;
  conceptNames: string[];
  message: string;
  focusConcept?: { name: string; summary?: string; keyPrinciples?: string[] };
  /** Earlier turns only — never includes `message`. */
  history: Pick<CourseChatMessage, 'role' | 'text'>[];
  /** Retrieved slide evidence; empty unless grounding is 'slides' or 'partial'. */
  excerpts: ChatExcerpt[];
  grounding: Grounding;
  unavailableSources: string[];
  /** AI concept summaries, sent only when no slide text exists ('summaries_only'). */
  summaries: ConceptSummary[];
}

export interface CourseChatReply {
  reply: string;
  degraded: boolean;
}

/** Asks the course-grounded tutor one question. */
export async function askCourseChat({
  courseId,
  ...payload
}: CourseChatRequest): Promise<CourseChatReply> {
  const response = await fetchWithTimeout(`/api/courses/${encodeURIComponent(courseId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'تعذر الوصول إلى شات المادة.');
  }

  return await response.json();
}
