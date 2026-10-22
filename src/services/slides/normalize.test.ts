import { describe, expect, it } from 'vitest';

import { bigrams, contentTokens, looseKey, normalizeText, tokenize } from './normalize';

const primaryOf = (word: string) => tokenize(word)[0]?.primary;
const looseOf = (word: string) => tokenize(word)[0]?.loose;

describe('normalizeText — primary key', () => {
  it('unifies alef variants أ / إ / آ / ٱ to ا', () => {
    expect(primaryOf('أمن')).toBe('امن');
    expect(primaryOf('إرسال')).toBe('ارسال');
    expect(primaryOf('آلية')).toBe('الية');
    expect(primaryOf('ٱلشبكة')).toBe('الشبكة');
  });

  it('removes diacritics and tatweel', () => {
    expect(primaryOf('الشَّبَكَةُ')).toBe('الشبكة');
    expect(primaryOf('الشـــبكة')).toBe('الشبكة');
  });

  it('converts Arabic-Indic and Persian digits to 0-9', () => {
    expect(normalizeText('٨٠٢.١١')).toBe('802.11');
    expect(normalizeText('۸۰۲')).toBe('802');
  });

  it('lowercases Latin and splits hyphens and slashes', () => {
    expect(tokenize('Access-Point').map((t) => t.primary)).toEqual(['access', 'point']);
    expect(tokenize('TCP/IP').map((t) => t.primary)).toEqual(['tcp', 'ip']);
  });

  it('does NOT fold ة/ه or ى/ي in the primary key', () => {
    expect(primaryOf('مكتبة')).not.toBe(primaryOf('مكتبه'));
    expect(primaryOf('على')).not.toBe(primaryOf('علي'));
  });
});

describe('looseKey — secondary key', () => {
  it('matches final ة/ه and ى/ي only at the loose level', () => {
    expect(looseOf('مكتبة')).toBe(looseOf('مكتبه'));
    expect(looseOf('مستوى')).toBe(looseOf('مستوي'));
  });

  it('strips the definite article and prefixed forms', () => {
    expect(looseOf('الشبكة')).toBe(looseOf('شبكة'));
    expect(looseOf('بالشبكة')).toBe(looseOf('شبكة'));
    expect(looseOf('للشبكة')).toBe(looseOf('شبكة'));
    expect(looseOf('والموجه')).toBe(looseOf('موجه'));
  });

  it('keeps short words intact when stripping would leave < 2 letters', () => {
    expect(looseKey('الف')).toBe('الف');
  });

  it('folds hamza seats ؤ and ئ', () => {
    expect(looseOf('مسؤول')).toBe(looseOf('مسوول'));
    expect(looseOf('بيئة')).toBe(looseOf('بييه'));
  });

  it('is the identity for Latin tokens', () => {
    expect(looseKey('router')).toBe('router');
  });
});

describe('stopwords and bigrams', () => {
  it('flags stopwords but keeps them in tokenize output', () => {
    const tokens = tokenize('ما وظيفة نقطة الوصول');
    expect(tokens.find((t) => t.primary === 'ما')?.stop).toBe(true);
    expect(contentTokens('ما وظيفة نقطة الوصول').map((t) => t.primary)).toEqual(['وظيفة', 'نقطة', 'الوصول']);
  });

  it('treats a stray "الـ" before a Latin term as a stopword', () => {
    expect(contentTokens('الـ Access Point').map((t) => t.primary)).toEqual(['access', 'point']);
  });

  it('produces loose-key bigrams for multi-word terms', () => {
    expect(bigrams(tokenize('Access Point'))).toEqual(['access point']);
    expect(bigrams(tokenize('نقطة الوصول'))).toEqual(['نقطه وصول']);
    expect(bigrams(tokenize('نقطه وصول'))).toEqual(['نقطه وصول']);
  });
});
