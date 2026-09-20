import { Type } from '@google/genai';

export const socraticEvalSchema = {
  type: Type.OBJECT,
  properties: {
    reasoningQualityScore: { type: Type.NUMBER },
    improvedUnderstanding: { type: Type.BOOLEAN },
    duckReaction: { type: Type.STRING },
    transferChallenge: {
      type: Type.OBJECT,
      properties: {
        scenario: { type: Type.STRING },
        task: { type: Type.STRING },
        hints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['scenario', 'task', 'hints'],
    },
  },
  required: ['reasoningQualityScore', 'improvedUnderstanding', 'duckReaction', 'transferChallenge'],
};
