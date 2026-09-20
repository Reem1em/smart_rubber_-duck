import { Type } from '@google/genai';

export const slidesSchema = {
  type: Type.OBJECT,
  properties: {
    presentationTitle: { type: Type.STRING },
    slides: {
      type: Type.ARRAY,
      description: 'قائمة شرائح العرض التقديمي الذكي',
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.NUMBER },
          title: { type: Type.STRING },
          bulletPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          duckTip: { type: Type.STRING },
        },
        required: ['slideNumber', 'title', 'bulletPoints', 'duckTip'],
      },
    },
  },
  required: ['presentationTitle', 'slides'],
};
