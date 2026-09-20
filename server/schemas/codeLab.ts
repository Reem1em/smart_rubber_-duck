import { Type } from '@google/genai';

export const codeLabSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['code_lab'] },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          difficulty: { type: Type.STRING, enum: ['Easy', 'Intermediate', 'Advanced'] },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          keyRequirements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['difficulty', 'title', 'description', 'keyRequirements'],
      },
    },
  },
  required: ['type', 'projects'],
};
