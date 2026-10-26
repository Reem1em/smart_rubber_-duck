import type { Concept, MaterialInput, SlideSource } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

/** Slightly above the server watchdog (170s), so the client always receives the server's own answer. */
const EXTRACT_TIMEOUT_MS = 180000;

/**
 * Extracts the full slide text of one file for the course chat.
 * Resolves to a SlideSource whose status may be ready / partial / failed / unsupported.
 * Throws only on transport errors and rate limits (err.isRateLimit), so callers can
 * record a `failed` source and surface the quota modal.
 */
export async function extractSlides(
  material: Pick<MaterialInput, 'fileName' | 'rawText' | 'base64Data' | 'mimeType'>,
  sourceId: string,
  concepts: Pick<Concept, 'id' | 'name'>[]
): Promise<SlideSource> {
  const response = await fetchWithTimeout(
    '/api/extract-slides',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId,
        fileName: material.fileName,
        textContent: material.base64Data ? undefined : material.rawText,
        base64Data: material.base64Data,
        mimeType: material.mimeType,
        concepts: concepts.map((c) => ({ id: c.id, name: c.name })),
      }),
    },
    EXTRACT_TIMEOUT_MS
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'تعذّر استخراج نص الشرائح.'), {
      status: response.status,
      isRateLimit: err.isRateLimit,
    });
  }

  return (await response.json()) as SlideSource;
}

/** A `failed` source recorded locally when the request itself could not complete. */
export function failedSlideSource(sourceId: string, fileName: string, error: string): SlideSource {
  return {
    sourceId,
    fileName,
    status: 'failed',
    chunks: [],
    slideCount: 0,
    incompleteSlides: [],
    extractedAt: Date.now(),
    error,
  };
}
