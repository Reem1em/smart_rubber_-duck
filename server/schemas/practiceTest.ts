import { Type } from '@google/genai';

/**
 * `propertyOrdering` makes the model emit `step_by_step_reasoning` before `correct_answer`
 * (Rule 2): the answer is generated after, and conditioned on, the worked solution.
 */
export const practiceTestSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          source_document: {
            type: Type.STRING,
            description: 'The name attribute of the <document> this question is based on.',
          },
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            description: 'Exactly 4 distinct options.',
            items: { type: Type.STRING },
          },
          step_by_step_reasoning: {
            type: Type.STRING,
            description: 'Explicit worked calculation or logic, in Arabic, proving which option is correct.',
          },
          correct_answer: {
            type: Type.STRING,
            description: 'Copied character-for-character from one entry of options.',
          },
          explanation: {
            type: Type.STRING,
            description: 'One or two Arabic sentences for the student: why the correct answer is correct.',
          },
        },
        propertyOrdering: ['id', 'source_document', 'question', 'options', 'step_by_step_reasoning', 'correct_answer', 'explanation'],
        required: ['id', 'source_document', 'question', 'options', 'step_by_step_reasoning', 'correct_answer', 'explanation'],
      },
    },
  },
  required: ['questions'],
};
