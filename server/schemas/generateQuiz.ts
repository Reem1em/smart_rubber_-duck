import { Type } from '@google/genai';

export const quizSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: 'قائمة 5 إلى 7 أسئلة متدرجة الصعوبة مرتبطة بمحتوى المادة الدراسية',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctAnswerIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
          difficulty: { type: Type.STRING },
        },
        required: ['id', 'question', 'options', 'correctAnswerIndex', 'explanation', 'difficulty'],
      },
    },
  },
  required: ['questions'],
};
