import { Type } from '@google/genai';

export const diagnoseSchema = {
  type: Type.OBJECT,
  properties: {
    statedConfidence: { type: Type.NUMBER },
    understandingScore: { type: Type.NUMBER },
    gapScore: { type: Type.NUMBER },
    gapType: { type: Type.STRING },
    gapDescription: { type: Type.STRING },
    identifiedFlaws: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    socraticQuestion: { type: Type.STRING },
    socraticHint: { type: Type.STRING },
  },
  required: [
    'statedConfidence',
    'understandingScore',
    'gapScore',
    'gapType',
    'gapDescription',
    'identifiedFlaws',
    'strengths',
    'socraticQuestion',
  ],
};
