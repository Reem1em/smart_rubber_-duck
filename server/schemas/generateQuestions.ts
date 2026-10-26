import { Type } from '@google/genai';

export const examAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    exam_questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: 'The question stem copied verbatim from the exam document (no options, no answer).',
          },
          topic_id: {
            type: Type.STRING,
            description: 'id of the single course topic this question tests, or an empty string if it tests none of them.',
          },
        },
        propertyOrdering: ['text', 'topic_id'],
        required: ['text', 'topic_id'],
      },
    },
  },
  required: ['exam_questions'],
};

/**
 * `propertyOrdering` makes the model emit `step_by_step_reasoning` before `correct_answer`,
 * so the answer is conditioned on the worked solution.
 */
export const generatedQuestionsSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic_id: { type: Type.STRING, description: 'id of the requested topic this question tests.' },
          source: {
            type: Type.STRING,
            enum: ['exam', 'mixed', 'course'],
            description:
              "'exam' if adapted from one question in <exam_document>; 'mixed' if that exam question is combined with facts from <uploaded_context>; otherwise 'course'.",
          },
          exam_excerpt: {
            type: Type.STRING,
            description: "For source 'exam' or 'mixed': the original exam question copied verbatim. Empty string for 'course'.",
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
        propertyOrdering: [
          'topic_id',
          'source',
          'exam_excerpt',
          'question',
          'options',
          'step_by_step_reasoning',
          'correct_answer',
          'explanation',
        ],
        required: [
          'topic_id',
          'source',
          'exam_excerpt',
          'question',
          'options',
          'step_by_step_reasoning',
          'correct_answer',
          'explanation',
        ],
      },
    },
  },
  required: ['questions'],
};
