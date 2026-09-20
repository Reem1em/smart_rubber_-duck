import {
  Concept,
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
  materialContext?: string
): Promise<DiagnosisResult> {
  const response = await fetchWithTimeout('/api/diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      studentExplanation,
      confidenceLevel,
      materialContext,
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
  socraticAnswer: string
): Promise<{ evaluation: SocraticEvaluation; transferChallenge: TransferChallenge }> {
  const response = await fetchWithTimeout('/api/socratic-eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      initialExplanation,
      socraticQuestion,
      socraticAnswer,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to evaluate Socratic answer.');
  }

  const data = await response.json();
  return {
    evaluation: {
      socraticAnswer,
      reasoningQualityScore: data.reasoningQualityScore,
      improvedUnderstanding: data.improvedUnderstanding,
      duckReaction: data.duckReaction,
    },
    transferChallenge: data.transferChallenge,
  };
}

export async function generateQuiz(
  concept: Concept,
  studentExplanation?: string,
  transferAnswer?: string,
  materialContext?: string
): Promise<QuizQuestion[]> {
  const response = await fetchWithTimeout('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      studentExplanation,
      transferAnswer,
      materialContext,
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
  quizTotal?: number
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
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل في إعداد التشخيص النهائي.');
  }

  return await response.json();
}
