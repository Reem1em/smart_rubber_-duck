import { Type } from '@google/genai';

export const finalDiagnosisSchema = {
  type: Type.OBJECT,
  properties: {
    masteryScore: { type: Type.NUMBER },
    gapResolved: { type: Type.BOOLEAN },
    duckVerdict: { type: Type.STRING },
    duckMood: { type: Type.STRING },
    detailedAnalysis: {
      type: Type.OBJECT,
      properties: {
        initialConfidence: { type: Type.NUMBER },
        initialUnderstanding: { type: Type.NUMBER },
        finalMastery: { type: Type.NUMBER },
        keyLearnings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        remainingGaps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['initialConfidence', 'initialUnderstanding', 'finalMastery', 'keyLearnings', 'remainingGaps'],
    },
  },
  required: ['masteryScore', 'gapResolved', 'duckVerdict', 'duckMood', 'detailedAnalysis'],
};
