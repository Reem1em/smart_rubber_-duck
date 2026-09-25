import { BugChallengeResponse, BugEvaluationResponse } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function generateBugChallenge(data: {
  language?: string;
  difficulty?: string;
}): Promise<BugChallengeResponse> {
  const response = await fetchWithTimeout('/generate-bug-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إنشاء تحدي صيد الأخطاء.');
  }

  return await response.json();
}

export async function evaluateBugChallenge(data: {
  buggyCode: string;
  userFixDescription: string;
  expectedBehavior: string;
  language?: string;
}): Promise<BugEvaluationResponse> {
  const response = await fetchWithTimeout('/evaluate-bug-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في تقييم حل الأخطاء.');
  }

  return await response.json();
}
