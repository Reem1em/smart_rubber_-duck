import { describe, expect, it } from 'vitest';

import { buildSlideChunks, sectionPlainText, splitSlideText, SLIDE_PART_CHARS } from './chunking';

const paragraph = (i: number) =>
  `Paragraph ${i}: An access point bridges wireless clients to the wired LAN. It operates at layer 2 and forwards frames. `.repeat(
    3
  );

describe('splitSlideText', () => {
  it('keeps a short slide as one part', () => {
    expect(splitSlideText('short text')).toEqual(['short text']);
  });

  it('splits a 5000-char slide losslessly into parts within the limit', () => {
    const text = Array.from({ length: 16 }, (_, i) => paragraph(i)).join('\n\n');
    expect(text.length).toBeGreaterThan(5000);
    const parts = splitSlideText(text);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.join('')).toBe(text);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(SLIDE_PART_CHARS);
  });

  it('prefers paragraph boundaries', () => {
    const text = Array.from({ length: 8 }, (_, i) => paragraph(i)).join('\n\n');
    const parts = splitSlideText(text);
    for (const p of parts.slice(0, -1)) expect(p.endsWith('\n\n')).toBe(true);
  });

  it('falls back to sentence boundaries when there are no line breaks', () => {
    const text = 'هذه جملة عن نقطة الوصول اللاسلكية. '.repeat(80);
    const parts = splitSlideText(text);
    expect(parts.join('')).toBe(text);
    for (const p of parts.slice(0, -1)) expect(p.trimEnd().endsWith('.')).toBe(true);
  });

  it('hard-splits only an unbroken run', () => {
    const text = 'x'.repeat(3000);
    const parts = splitSlideText(text);
    expect(parts.join('')).toBe(text);
    expect(parts.every((p) => p.length <= SLIDE_PART_CHARS)).toBe(true);
  });
});

describe('buildSlideChunks', () => {
  it('gives every part a unique id and consistent partCount, visual on part 1 only', () => {
    const long = Array.from({ length: 10 }, (_, i) => paragraph(i)).join('\n\n');
    const chunks = buildSlideChunks('file1', [
      { slideIndex: 1, heading: 'Intro', text: 'hello', keywords: [], conceptIds: [] },
      { slideIndex: 2, heading: 'APs', text: long, visual: 'AP → Switch (uplink)', keywords: ['access point'], conceptIds: ['c1'] },
    ]);
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slide2 = chunks.filter((c) => c.slideIndex === 2);
    expect(slide2.length).toBeGreaterThan(1);
    expect(slide2.every((c) => c.partCount === slide2.length)).toBe(true);
    expect(slide2.map((c) => c.part)).toEqual(slide2.map((_, i) => i + 1));
    expect(slide2[0].visual).toBe('AP → Switch (uplink)');
    expect(slide2.slice(1).every((c) => c.visual === undefined)).toBe(true);
    expect(slide2.map((c) => c.text).join('')).toBe(long);
    expect(slide2[0].id).toBe('file1#s2p1');
  });
});

describe('sectionPlainText', () => {
  it('splits on markdown headings and links concepts by name', () => {
    const slides = sectionPlainText('# Access Point\nAn access point connects wireless clients.\n\n# Router\nRoutes packets.', [
      { id: 'ap', name: 'Access Point' },
      { id: 'rt', name: 'Router' },
    ]);
    expect(slides.map((s) => s.heading)).toEqual(['Access Point', 'Router']);
    expect(slides[0].conceptIds).toEqual(['ap']);
    expect(slides[1].conceptIds).toEqual(['rt']);
    expect(slides[0].keywords).toEqual(['access', 'point']);
  });

  it('groups paragraphs when there are no headings and keeps all text', () => {
    const text = Array.from({ length: 6 }, (_, i) => paragraph(i)).join('\n\n');
    const slides = sectionPlainText(text, []);
    expect(slides.length).toBeGreaterThan(1);
    const joined = slides.map((s) => s.text).join('\n\n');
    expect(joined.replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' ').trim());
  });
});
