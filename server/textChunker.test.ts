import { describe, expect, it } from 'vitest';

import { chunkText, findLastHeading } from './textChunker';

const paragraph = (label: string, length: number) => `${label} ${'word '.repeat(Math.ceil(length / 5))}`.slice(0, length).trim() + '.';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkText('Short document.');
    expect(chunks).toEqual([{ index: 0, text: 'Short document.', carriedHeading: undefined }]);
  });

  it('keeps every chunk within the size ceiling and loses no content', () => {
    const text = Array.from({ length: 12 }, (_, i) => paragraph(`P${i}`, 3_000)).join('\n\n');
    const chunks = chunkText(text, { minChars: 10_000, maxChars: 12_000 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(12_000);
    expect(chunks.map((c) => c.text).join('\n\n')).toBe(text);
  });

  it('prefers a heading boundary over a plain paragraph break', () => {
    const text = [paragraph('A', 9_000), '## Chapter 2', paragraph('B', 1_500), paragraph('C', 5_000)].join('\n\n');
    const chunks = chunkText(text, { minChars: 5_000, maxChars: 12_000 });

    expect(chunks[1].text.startsWith('## Chapter 2')).toBe(true);
  });

  it('never cuts mid-word when there are no line breaks', () => {
    const text = 'alpha beta gamma '.repeat(2_000).trim();
    const chunks = chunkText(text, { minChars: 10_000, maxChars: 12_000 });

    for (const chunk of chunks) {
      expect(chunk.text.startsWith('alpha') || chunk.text.startsWith('beta') || chunk.text.startsWith('gamma')).toBe(true);
    }
    expect(chunks.map((c) => c.text).join(' ')).toBe(text);
  });

  it('hard-cuts an unbroken run longer than the ceiling', () => {
    const chunks = chunkText('x'.repeat(25_000), { minChars: 10_000, maxChars: 12_000 });
    expect(chunks.map((c) => c.text.length)).toEqual([12_000, 12_000, 1_000]);
  });

  it('carries the active heading into a chunk that starts mid-section', () => {
    const text = ['الفصل الثالث: المصفوفات', paragraph('M', 11_000), paragraph('N', 4_000)].join('\n\n');
    const chunks = chunkText(text, { minChars: 10_000, maxChars: 12_000 });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].carriedHeading).toBeUndefined();
    expect(chunks[1].carriedHeading).toBe('الفصل الثالث: المصفوفات');
  });
});

describe('findLastHeading', () => {
  it('finds markdown and labelled headings, ignoring long lines', () => {
    expect(findLastHeading('# Intro\ntext\nWeek 4 Graphs\nmore text')).toBe('Week 4 Graphs');
    expect(findLastHeading(`Chapter 1 ${'x'.repeat(200)}`)).toBeUndefined();
  });
});
