import { Type } from '@google/genai';

export const bugChallengeSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['debugging_challenge'] },
    challenge: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        language: { type: Type.STRING },
        difficulty: { type: Type.STRING },
        expectedBehavior: { type: Type.STRING },
        buggyCode: { type: Type.STRING },
        totalBugsCount: { type: Type.NUMBER },
      },
      required: ['title', 'language', 'difficulty', 'expectedBehavior', 'buggyCode', 'totalBugsCount'],
    },
  },
  required: ['type', 'challenge'],
};

export const bugEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    identifiedBugs: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    missedBugs: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    correctedCode: { type: Type.STRING },
  },
  required: ['score', 'summary', 'identifiedBugs', 'missedBugs', 'correctedCode'],
};
