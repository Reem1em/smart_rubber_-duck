/** Defect A, route level: text layer → OCR fallback → specific diagnostic. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateWithRetry = vi.fn();
vi.mock('../gemini', () => ({
  generateWithRetry: (...args: unknown[]) => generateWithRetry(...args),
  isQuotaOrRateLimitError: (err: any) => err?.status === 429,
}));

import { handleExtractSlides, looseTranscript } from './extractSlides';
import { SAMPLE_EXAM_PAGES, corruptPdf, imageOnlyPdf, textPdf } from '../testFixtures/pdf';

function call(body: any) {
  const res: any = { statusCode: 200 };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (b: any) => ((res.body = b), res);
  return Promise.resolve(handleExtractSlides({ body } as any, res)).then(() => res);
}

const pdfBody = (buf: Buffer, fileName = 'exam.pdf') => ({
  sourceId: 'f1',
  fileName,
  base64Data: buf.toString('base64'),
  mimeType: 'application/pdf',
  concepts: [],
});

const allText = (body: any) => body.chunks.map((c: any) => c.text).join('\n');

beforeEach(() => generateWithRetry.mockReset());

describe('POST /api/extract-slides — PDFs', () => {
  it('(a) text-based PDF: extracted from the text layer, no OCR call', async () => {
    const res = await call(pdfBody(textPdf(SAMPLE_EXAM_PAGES)));
    expect(generateWithRetry).not.toHaveBeenCalled();
    expect(res.body.status).toBe('ready');
    expect(allText(res.body)).toContain('Q4. Correct the error: He have two brothers.');
    expect(res.body.chunks[0].slideIndex).toBe(1); // real page numbers
    expect(res.body.diagnostic).toMatchObject({
      pageCount: 2,
      pagesWithTextLayer: 2,
      extractors: [
        { name: 'pdf_text_layer', outcome: 'ok' },
        { name: 'gemini_ocr', outcome: 'skipped' },
      ],
    });
  });

  it('(b) scanned PDF: falls through to OCR and uses its transcript', async () => {
    generateWithRetry.mockResolvedValue({
      text: '=== SLIDE 1 | Q1 ===\nKEYWORDS: grammar\nCONCEPTS: none\nTEXT:\nQ1. Choose the correct form of the verb.\nVISUAL: none\nUNREADABLE: no\n=== END SLIDE ===\n=== END OF DOCUMENT ===',
    });
    const res = await call(pdfBody(imageOnlyPdf(1)));
    expect(generateWithRetry).toHaveBeenCalledTimes(1);
    expect(res.body.status).toBe('ready');
    expect(allText(res.body)).toContain('Choose the correct form');
    expect(res.body.diagnostic.extractors).toEqual([
      expect.objectContaining({ name: 'pdf_text_layer', outcome: 'empty' }),
      { name: 'gemini_ocr', outcome: 'ok' },
    ]);
  });

  it('(b) scanned PDF with OCR unavailable: specific diagnostic, not the generic message', async () => {
    generateWithRetry.mockRejectedValue(Object.assign(new Error('Model x timed out after 120000ms'), { status: 504 }));
    const res = await call(pdfBody(imageOnlyPdf(2), 'scan.pdf'));
    expect(res.body.status).toBe('failed');
    expect(res.body.error).not.toContain('تمت قراءة الملف كاملاً');
    expect(res.body.error).toContain('«scan.pdf»');
    expect(res.body.error).toContain('عدد الصفحات: 2');
    expect(res.body.error).toContain('صفحات فيها طبقة نص: 0');
    expect(res.body.error).toContain('التعرف الضوئي');
    expect(res.body.diagnostic.extractors.map((e: any) => [e.name, e.outcome])).toEqual([
      ['pdf_text_layer', 'empty'],
      ['gemini_ocr', 'timeout'],
    ]);
  });

  it('(b) OCR answers outside the slide format: the text is kept, not discarded', async () => {
    generateWithRetry.mockResolvedValue({
      text: 'Question 1: Choose the correct form of the verb in each sentence below and explain the rule you used for the subject.',
    });
    const res = await call(pdfBody(imageOnlyPdf(1)));
    expect(res.body.status).toBe('ready');
    expect(allText(res.body)).toContain('Choose the correct form');
  });

  it('(c) corrupt PDF: specific error, no OCR call', async () => {
    const res = await call(pdfBody(corruptPdf(), 'broken.pdf'));
    expect(generateWithRetry).not.toHaveBeenCalled();
    expect(res.body.status).toBe('failed');
    expect(res.body.error).toContain('«broken.pdf»');
    expect(res.body.error).toContain('تالف');
    expect(res.body.diagnostic.extractors).toEqual([expect.objectContaining({ name: 'pdf_text_layer', outcome: 'failed' })]);
  });

  it('(d) a non-PDF sent as application/pdf is rejected with a clear reason', async () => {
    const res = await call(pdfBody(Buffer.from('PK\u0003\u0004 this is a zip'), 'renamed.pdf'));
    expect(generateWithRetry).not.toHaveBeenCalled();
    expect(res.body.status).toBe('failed');
    expect(res.body.error).toContain('ليس PDF');
  });
});

describe('looseTranscript', () => {
  it('rejects refusals and fragments', () => {
    expect(looseTranscript("I'm sorry, but I cannot read this document because the image is too blurry to transcribe.", [])).toEqual([]);
    expect(looseTranscript('Q1', [])).toEqual([]);
  });
});
