import {
  Concept,
  CourseScope,
  DiagnosisResult,
  FinalDiagnosisResult,
  QuizQuestion,
  SocraticEvaluation,
  TransferChallenge,
} from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function diagnoseExplanation(
  concept: Concept,
  studentExplanation: string,
  confidenceLevel: number,
  materialContext?: string,
  courseScope?: CourseScope
): Promise<DiagnosisResult> {
  const response = await fetchWithTimeout('/api/diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      studentExplanation,
      confidenceLevel,
      materialContext,
      courseScope,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to diagnose explanation.');
  }

  return await response.json();
}

export async function evaluateSocraticAnswer(
  concept: Concept,
  initialExplanation: string,
  socraticQuestion: string,
  socraticAnswer: string,
  courseScope?: CourseScope
): Promise<{ evaluation: SocraticEvaluation; transferChallenge: TransferChallenge }> {
  const response = await fetchWithTimeout('/api/socratic-eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      initialExplanation,
      socraticQuestion,
      socraticAnswer,
      courseScope,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to evaluate Socratic answer.');
  }

  const data = await response.json();
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [];
  return {
    evaluation: {
      socraticAnswer,
      reasoningQualityScore: data.reasoningQualityScore,
      improvedUnderstanding: data.improvedUnderstanding,
      duckReaction: data.duckReaction,
      correctPoints: strings(data.correctPoints),
      conceptualGaps: strings(data.conceptualGaps),
    },
    transferChallenge: data.transferChallenge,
  };
}

export async function generateQuiz(
  concept: Concept,
  studentExplanation?: string,
  transferAnswer?: string,
  materialContext?: string,
  courseScope?: CourseScope
): Promise<QuizQuestion[]> {
  const response = await fetchWithTimeout('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      studentExplanation,
      transferAnswer,
      materialContext,
      courseScope,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إنشاء الاختبار القصير.');
  }

  const data = await response.json();
  return data.questions || [];
}

export async function generateFinalDiagnosis(
  concept: Concept,
  diagnosis: DiagnosisResult,
  socraticAnswer: string,
  transferChallenge: TransferChallenge,
  transferAnswer: string,
  quizScore?: number,
  quizTotal?: number,
  courseScope?: CourseScope
): Promise<FinalDiagnosisResult> {
  const response = await fetchWithTimeout('/api/final-diagnosis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      diagnosis,
      socraticAnswer,
      transferChallenge,
      transferAnswer,
      quizScore,
      quizTotal,
      courseScope,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إعداد التشخيص النهائي.');
  }

  return await response.json();
}
