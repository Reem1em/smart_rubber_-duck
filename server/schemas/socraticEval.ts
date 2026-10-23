import { Type } from '@google/genai';

export const socraticEvalSchema = {
  type: Type.OBJECT,
  properties: {
    reasoningQualityScore: { type: Type.NUMBER },
    improvedUnderstanding: { type: Type.BOOLEAN },
    duckReaction: { type: Type.STRING },
    correctPoints: {
      type: Type.ARRAY,
      description: 'أين أصبت: نقاط مفاهيمية عبّر عنها الطالب بشكل صحيح',
      items: { type: Type.STRING },
    },
    conceptualGaps: {
      type: Type.ARRAY,
      description: 'أين أخطأت / الفجوات المفاهيمية: منطق خاطئ أو ناقص في إجابة الطالب',
      items: { type: Type.STRING },
    },
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
  required: [
    'reasoningQualityScore',
    'improvedUnderstanding',
    'duckReaction',
    'correctPoints',
    'conceptualGaps',
    'transferChallenge',
  ],
};
