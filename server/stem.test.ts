import { describe, expect, it } from 'vitest';

import { isProgrammingTopic, isStemTopic } from './stem';

describe('isStemTopic', () => {
  it('detects math courses', () => {
    expect(isStemTopic('الجبر الخطي', 'المحددات')).toBe(true);
    expect(isStemTopic('Calculus I', 'Derivatives')).toBe(true);
  });

  it('does not turn programming vocabulary into math', () => {
    expect(isStemTopic('برمجة بايثون', 'الدوال والمصفوفات')).toBe(false);
    expect(isStemTopic('Intro to Python', 'Writing a function')).toBe(false);
  });

  it('keeps genuine math inside a programming context', () => {
    expect(isStemTopic('Python for linear algebra', 'matrix inverse')).toBe(true);
  });

  it('is false for non-STEM topics', () => {
    expect(isStemTopic('تاريخ الأندلس', 'سقوط غرناطة')).toBe(false);
    expect(isStemTopic(undefined, '')).toBe(false);
  });
});

describe('isProgrammingTopic', () => {
  it('detects programming courses in Arabic and English', () => {
    expect(isProgrammingTopic('مقدمة في البرمجة')).toBe(true);
    expect(isProgrammingTopic('JavaScript basics')).toBe(true);
    expect(isProgrammingTopic('الجبر الخطي')).toBe(false);
  });
});
