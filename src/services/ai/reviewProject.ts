import { ProjectReviewResponse } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function reviewProject(data: {
  subjectName?: string;
  codeSnippet?: string;
  projectRequest?: string;
  studentLevel?: string;
}): Promise<ProjectReviewResponse> {
  const response = await fetchWithTimeout('/review-project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في مراجعة المشروعات والكود.');
  }

  return await response.json();
}
