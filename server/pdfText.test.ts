/** Defect A: PDF text-layer extraction (step 1 of the layered strategy). */
import { describe, expect, it } from 'vitest';

import { extractPdfText, joinTextItems, normalizePdfText, textLayerIsUsable } from './pdfText';
import { SAMPLE_EXAM_PAGES, corruptPdf, imageOnlyPdf, textPdf } from './testFixtures/pdf';

const item = (str: string, x: number, width: number, y = 700, size = 12, hasEOL = false) => ({
  str,
  transform: [size, 0, 0, size, x, y],
  width,
  height: size,
  hasEOL,
});

describe('normalizePdfText', () => {
  it('maps Arabic presentation forms to base letters and unmapped glyphs to spaces', () => {
    // As emitted by a real Arabic exam PDF: presentation forms, tatweel and U+FFFD word gaps.
    expect(normalizePdfText('اﻧــﻀـﻢ�ﻟﻠﻘﻨﺎة�ﻟﻠﻤﺰﻳــــﺪ')).toBe('انضم للقناة للمزيد');
  });

  it('keeps superscripts and math symbols (no blanket NFKC)', () => {
    expect(normalizePdfText('x² + y² = r²  ∫ f(x) dx')).toBe('x² + y² = r² ∫ f(x) dx');
  });
});

describe('joinTextItems', () => {
  it('joins per-glyph RTL items into words, spacing only at real gaps', () => {
    // Positions from a real file: glyphs touch inside a word; a visible gap separates words.
    const items = [item('ت', 413, 5), item('م', 404, 8), item('ن', 400, 4), item('و', 392, 7), item('ا', 389, 3),
      item('و', 376, 7), item('ا', 373, 3)];
    expect(normalizePdfText(joinTextItems(items))).toBe('تمنوا وا');
  });

  it('does not split numbers drawn as separate items ("202 6")', () => {
    expect(joinTextItems([item('202', 100, 18), item('6', 118, 6)])).toBe('2026');
  });

  it('starts a new line when the baseline changes', () => {
    expect(joinTextItems([item('Q1', 72, 14, 720), item('Q2', 72, 14, 700)])).toBe('Q1\nQ2');
  });
});

describe('extractPdfText', () => {
  it('reads the text layer of a text-based PDF, page by page', async () => {
    const r = await extractPdfText(textPdf(SAMPLE_EXAM_PAGES));
    expect(r.ok).toBe(true);
    if (!('pages' in r)) throw new Error('unreachable');
    expect(r.pageCount).toBe(2);
    expect(r.pagesWithText).toBe(2);
    expect(r.pages[0]).toContain('She (go / goes) to school every day.');
    expect(r.pages[1]).toContain('He have two brothers.');
    expect(textLayerIsUsable(r)).toBe(true);
  });

  it('reports an image-only PDF as having no text layer (so OCR must run)', async () => {
    const r = await extractPdfText(imageOnlyPdf(3));
    if (!('pages' in r)) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
    expect(r.pageCount).toBe(3);
    expect(r.pagesWithText).toBe(0);
    expect(textLayerIsUsable(r)).toBe(false);
  });

  it('classifies corrupt, empty and non-PDF input with a specific reason', async () => {
    expect(await extractPdfText(corruptPdf())).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(await extractPdfText(Buffer.alloc(0))).toMatchObject({ ok: false, reason: 'empty_file', bytes: 0 });
    expect(await extractPdfText(Buffer.from('PK\u0003\u0004 not a pdf'))).toMatchObject({ ok: false, reason: 'not_pdf' });
  });

  it('never hangs: a timeout comes back as a typed failure', async () => {
    const r = await extractPdfText(textPdf(SAMPLE_EXAM_PAGES), 0);
    expect(r).toMatchObject({ ok: false, reason: 'timeout' });
  });
});
