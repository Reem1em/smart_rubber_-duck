import { describe, expect, it } from 'vitest';

import { quizEvalFallback } from './quizEval';

const question = {
  question: 'Q',
  options: ['a', 'b', 'c'],
  correctAnswerIndex: 2,
  explanation: 'Reference explanation for the question.',
};

describe('quizEvalFallback', () => {
  it('reports "correct" for a correct index and reuses the question explanation', () => {
    const out: any = quizEvalFallback({ question, studentAnswerIndex: 2 });
    expect(out.status).toBe('correct');
    expect(out.degraded).toBe(true);
    expect(out.explanation).toBe(question.explanation);
  });

  it('reports "incorrect" for a wrong index', () => {
    const out: any = quizEvalFallback({ question, studentAnswerIndex: 0 });
    expect(out.status).toBe('incorrect');
  });

  it('never claims "correct" when the answer key is missing', () => {
    const out: any = quizEvalFallback({ question: { question: 'Q' }, studentAnswerIndex: 0 });
    expect(out.status).toBe('incorrect');
    expect(out.explanation).not.toBe('');
  });
});
