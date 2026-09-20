import { CodeLabResponse } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function generateCodeLab(data: {
  language?: string;
  topic?: string;
}): Promise<CodeLabResponse> {
  const response = await fetchWithTimeout('/generate-code-lab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إنشاء مشروعات المعمل البرمجي.');
  }

  return await response.json();
}
