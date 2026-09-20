import { TermPlanResponse } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function generatePlan(data: {
  courses?: string;
  finalExamSchedule?: string;
  dailyStudyHours?: number;
  upcomingQuizzes?: string;
  extraNotes?: string;
  userExamDates?: string;
  targetExamDate?: string;
  rawDocumentText?: string;
}): Promise<TermPlanResponse> {
  const response = await fetchWithTimeout('/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إنشاء الخطة الدراسية المحكمة.');
  }

  return await response.json();
}

