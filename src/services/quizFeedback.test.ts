import { describe, expect, it } from 'vitest';

import type { QuizQuestion } from '../types';
import { firstSentences, quickQuizFeedback } from './quizFeedback';

const q: QuizQuestion = {
  id: 1,
  question: 'ما الوظيفة الأساسية لنقطة الوصول؟',
  options: ['توجيه الحزم بين الشبكات', 'ربط الأجهزة اللاسلكية بالشبكة السلكية', 'توزيع عناوين IP دائماً', 'تشفير الأقراص'],
  correctAnswerIndex: 1,
  explanation: 'نقطة الوصول تربط العملاء اللاسلكيين بالشبكة السلكية. تعمل في الطبقة الثانية. ولا توجه الحزم.',
  difficulty: 'بسيط',
  optionNotes: [
    'التوجيه بين الشبكات وظيفة الراوتر لا نقطة الوصول.',
    'صحيح: هذه وظيفتها الأساسية في الطبقة الثانية.',
    'توزيع العناوين وظيفة خادم DHCP عادةً.',
    'التشفير ليس من وظائفها.',
  ],
};

describe('quickQuizFeedback — instant, deterministic, no model call', () => {
  it('marks the answer-key option correct, with its note', () => {
    expect(quickQuizFeedback(q, 1)).toEqual({ status: 'correct', explanation: q.optionNotes![1] });
  });

  it('marks any other option incorrect and explains that specific option', () => {
    expect(quickQuizFeedback(q, 2)).toEqual({ status: 'incorrect', explanation: q.optionNotes![2] });
  });

  it('the verdict follows correctAnswerIndex even if a note sounds positive', () => {
    const tricky = { ...q, optionNotes: ['صحيح تماماً!', ...q.optionNotes!.slice(1)] };
    expect(quickQuizFeedback(tricky, 0).status).toBe('incorrect');
  });

  it('falls back to a trimmed explanation for older quizzes without option notes', () => {
    const legacy = { ...q, optionNotes: undefined };
    expect(quickQuizFeedback(legacy, 1)).toEqual({
      status: 'correct',
      explanation: 'نقطة الوصول تربط العملاء اللاسلكيين بالشبكة السلكية. تعمل في الطبقة الثانية.',
    });
    expect(quickQuizFeedback(legacy, 0)).toEqual({
      status: 'incorrect',
      explanation: 'الإجابة الصحيحة هي الخيار B. نقطة الوصول تربط العملاء اللاسلكيين بالشبكة السلكية.',
    });
  });

  it('ignores notes that do not line up with the options', () => {
    expect(quickQuizFeedback({ ...q, optionNotes: ['a', 'b'] }, 1).explanation).toContain('نقطة الوصول');
  });
});

describe('firstSentences', () => {
  it('keeps at most N sentences of plain text', () => {
    expect(firstSentences('أ. ب؟ ج! د.', 2)).toBe('أ. ب؟');
  });

  it('never cuts text that contains LaTeX', () => {
    const t = 'الناتج $2.5$. ثم نطبق $$x^2$$. وأخيراً.';
    expect(firstSentences(t, 1)).toBe(t);
  });
});
