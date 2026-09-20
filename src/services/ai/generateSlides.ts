import { Concept, SlidePresentation } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function generateSlides(
  concept: Concept,
  materialContext?: string
): Promise<SlidePresentation> {
  const response = await fetchWithTimeout('/api/generate-slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      materialContext,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إنشاء شرائح العرض.');
  }

  return await response.json();
}
