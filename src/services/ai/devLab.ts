import { CustomLabEvaluation, CustomLabTestCase, DevChallenge, DevEvaluation, DevLabMode } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

async function postJson<T>(url: string, data: unknown, fallbackError: string): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || fallbackError);
  }

  return await response.json();
}

/** Generates a Feature Builder ticket or a Bug-Hunter snippet. */
export function generateDevChallenge(data: {
  mode: DevLabMode;
  language: string;
  level: string;
}): Promise<DevChallenge> {
  return postJson<DevChallenge>('/api/code-lab/challenge', data, 'فشل في إنشاء التحدي البرمجي.');
}

/** Grades the student's submission against correctness, edge cases and code quality. */
export function evaluateDevSubmission(data: {
  mode: DevLabMode;
  language: string;
  level: string;
  challenge: string;
  studentCode: string;
  studentExplanation?: string;
}): Promise<DevEvaluation> {
  return postJson<DevEvaluation>('/api/code-lab/evaluate', data, 'فشل في تقييم الحل البرمجي.');
}

/** Evaluates student code against a custom lab assignment with user-defined test cases. */
export function evaluateCustomLab(data: {
  taskPrompt: string;
  language: string;
  testCases: CustomLabTestCase[];
  constraints: string;
  studentCode: string;
}): Promise<CustomLabEvaluation> {
  return postJson<CustomLabEvaluation>('/api/code-lab/custom-evaluate', data, 'فشل في تقييم حل المسألة المخصصة.');
}
