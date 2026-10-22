import { describe, expect, it } from 'vitest';

import { END_OF_DOCUMENT, mergeSlides, parseTranscript } from './parseTranscript';

const block = (n: number, opts: { heading?: string; visual?: string; unreadable?: string; concepts?: string } = {}) =>
  [
    `=== SLIDE ${n} | ${opts.heading ?? `Slide ${n}`} ===`,
    'KEYWORDS: access point; نقطة الوصول; WLAN',
    `CONCEPTS: ${opts.concepts ?? 'c1, bogus-id'}`,
    'TEXT:',
    `Body of slide ${n}.`,
    'Second line.',
    'VISUAL:',
    opts.visual ?? 'none',
    `UNREADABLE: ${opts.unreadable ?? 'no'}`,
    '=== END SLIDE ===',
  ].join('\n');

const allowed = new Set(['c1', 'c2']);

describe('parseTranscript', () => {
  it('parses every slide of a complete transcript', () => {
    const raw = [block(1), block(2, { visual: 'Laptop → AP → Switch (wired uplink)' }), END_OF_DOCUMENT].join('\n');
    const out = parseTranscript(raw, allowed);
    expect(out.complete).toBe(true);
    expect(out.lastSlide).toBe(2);
    expect(out.slides).toHaveLength(2);
    expect(out.slides[0]).toMatchObject({
      slideIndex: 1,
      heading: 'Slide 1',
      text: 'Body of slide 1.\nSecond line.',
      keywords: ['access point', 'نقطة الوصول', 'WLAN'],
      conceptIds: ['c1'],
    });
    expect(out.slides[0].visual).toBeUndefined();
    expect(out.slides[1].visual).toBe('Laptop → AP → Switch (wired uplink)');
  });

  it('keeps only complete blocks of a truncated transcript', () => {
    const raw = [block(1), block(2), '=== SLIDE 3 | Cut ===\nKEYWORDS: x\nTEXT:\nhalf a sent'].join('\n');
    const out = parseTranscript(raw, allowed);
    expect(out.complete).toBe(false);
    expect(out.lastSlide).toBe(2);
    expect(out.slides.map((s) => s.slideIndex)).toEqual([1, 2]);
  });

  it('drops concept ids that were not supplied', () => {
    const out = parseTranscript(block(1, { concepts: 'bogus, c2, c2' }), allowed);
    expect(out.slides[0].conceptIds).toEqual(['c2']);
  });

  it('flags unreadable content as incomplete', () => {
    const out = parseTranscript(block(4, { unreadable: 'yes — the table values in the lower half are blurred' }), allowed);
    expect(out.slides[0].incomplete).toBe(true);
  });

  it('tolerates a markdown code fence around the transcript', () => {
    const out = parseTranscript('```text\n' + block(1) + '\n' + END_OF_DOCUMENT + '\n```', allowed);
    expect(out.complete).toBe(true);
    expect(out.slides).toHaveLength(1);
  });
});

describe('mergeSlides', () => {
  it('dedupes overlapping continuations, keeping the first copy', () => {
    const first = parseTranscript([block(1), block(2, { heading: 'first copy' })].join('\n'), allowed).slides;
    const second = parseTranscript([block(2, { heading: 'second copy' }), block(3)].join('\n'), allowed).slides;
    const merged = mergeSlides(first, second);
    expect(merged.map((s) => s.slideIndex)).toEqual([1, 2, 3]);
    expect(merged[1].heading).toBe('first copy');
  });
});
