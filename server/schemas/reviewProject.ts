import { Type } from '@google/genai';

export const projectReviewSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: 'درجة التقييم البرمجي من 0 إلى 100' },
    summary: { type: Type.STRING, description: 'ملخص شامل رفيع المستوى' },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    gaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    bestPractices: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    improvedCodeSnippet: { type: Type.STRING, description: 'الكود المصحح بالنص الأصلي للغة البرمجة' },
  },
  required: ['score', 'summary', 'strengths', 'gaps', 'bestPractices', 'improvedCodeSnippet'],
};
