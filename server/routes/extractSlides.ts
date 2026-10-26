import type { Request, Response } from 'express';
import { ThinkingLevel } from '@google/genai';

import { generateWithRetry, isQuotaOrRateLimitError } from '../gemini';
import { buildSystemPrompt } from '../utils/loadAgent';
import { buildExtractSlidesPrompt } from '../prompts/extractSlides';
import { mergeSlides, parseTranscript } from '../slides/parseTranscript';
import { MSG_OFFICE_UNSUPPORTED, docxToText, isDocx, isUnreadableOffice } from '../docText';
import { extractPdfText, meaningfulChars, textLayerIsUsable, type PdfFailure } from '../pdfText';
import { formatDiagnostic } from '../extractionDiagnostic';
import { buildSlideChunks, pageSlides, sectionPlainText, type ParsedSlide } from '../../src/services/slides/chunking';
import type { ExtractionDiagnostic } from '../../src/types';

const SYSTEM_PROMPT = buildSystemPrompt('01_ANALYZER.md');

/** Continuation calls per file when a transcript hits the model's output limit. */
const MAX_CALLS = 4;
const MAX_OUTPUT_TOKENS = 32768;
/** Whole-request model budget: stays under the 170s API watchdog so a long file returns `partial`, not a 503. */
const TOTAL_BUDGET_MS = 150000;
const PER_CALL_TIMEOUT_MS = 120000;
/** Storage guard: text beyond this is not stored and the source is marked partial. */
const MAX_SOURCE_CHARS = 3_000_000;
const MAX_TEXT_INPUT_CHARS = 2_000_000;

const MSG_TRUNCATED = (n: number) =>
  `تم استخراج نص الشرائح حتى الشريحة ${n} فقط؛ بقية الملف لم تُستخرج بعد. أعد المعالجة لاحقاً لإكمالها.`;
const MSG_UNREADABLE = (slides: number[]) =>
  `بعض الأجزاء غير مقروءة في الشرائح: ${slides.join('، ')}؛ لم يُخمَّن محتواها.`;
/** Only reachable for a text source that sections to nothing; PDFs/images get a full diagnostic. */
const MSG_EMPTY = 'لم يُعثر في الملف على نص قابل للقراءة.';
const MSG_LAYER_ONLY = (pages: number, total: number | null) =>
  `قُرئ النص المضمّن في ${pages} صفحة فقط من ${total ?? '؟'}؛ بقية الصفحات صور ولم ينجح التعرف الضوئي عليها الآن.`;
const MSG_UNSUPPORTED_MIME = (mime: string) =>
  `صيغة الملف (${mime || 'غير معروفة'}) غير مدعومة لاستخراج النص. الصيغ المدعومة: PDF، صور PNG/JPG، ‎.docx، ‎.txt.`;

interface ConceptRef {
  id: string;
  name: string;
}

function readConcepts(raw: unknown): ConceptRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: any) => typeof c?.id === 'string' && typeof c?.name === 'string')
    .slice(0, 200)
    .map((c: any) => ({ id: c.id, name: c.name.slice(0, 200) }));
}

/** Applies the storage guard and derives the honest source status. */
function finalizeSource(
  sourceId: string,
  fileName: string,
  slides: ParsedSlide[],
  transcriptComplete: boolean,
  note?: string
) {
  let total = 0;
  let kept = slides;
  let truncatedAfterSlide: number | undefined;
  for (let i = 0; i < slides.length; i++) {
    total += slides[i].text.length + (slides[i].visual?.length ?? 0);
    if (total > MAX_SOURCE_CHARS) {
      kept = slides.slice(0, i);
      truncatedAfterSlide = kept.length ? kept[kept.length - 1].slideIndex : 0;
      break;
    }
  }
  if (truncatedAfterSlide === undefined && !transcriptComplete) {
    truncatedAfterSlide = kept.length ? kept[kept.length - 1].slideIndex : 0;
  }

  const incompleteSlides = kept.filter((s) => s.incomplete).map((s) => s.slideIndex);
  const errors: string[] = note ? [note] : [];
  if (truncatedAfterSlide !== undefined) errors.push(MSG_TRUNCATED(truncatedAfterSlide));
  if (incompleteSlides.length) errors.push(MSG_UNREADABLE(incompleteSlides));

  const status = kept.length === 0 ? 'failed' : errors.length ? 'partial' : 'ready';
  return {
    sourceId,
    fileName,
    status,
    chunks: buildSlideChunks(sourceId, kept),
    slideCount: kept.length,
    incompleteSlides,
    ...(truncatedAfterSlide !== undefined ? { truncatedAfterSlide } : {}),
    extractedAt: Date.now(),
    ...(kept.length === 0 ? { error: MSG_EMPTY } : errors.length ? { error: errors.join(' ') } : {}),
  };
}

function failedSource(
  sourceId: string,
  fileName: string,
  error: string,
  status: 'failed' | 'unsupported' = 'failed',
  diagnostic?: ExtractionDiagnostic
) {
  return {
    ...(diagnostic ? { diagnostic } : {}),
    sourceId,
    fileName,
    status,
    chunks: [],
    slideCount: 0,
    incompleteSlides: [],
    extractedAt: Date.now(),
    error,
  };
}

/**
 * POST /api/extract-slides
 *
 * Extracts the full text of one uploaded file (course chapters and exam models). Text sources are
 * sectioned deterministically. PDFs: (1) their own text layer via pdf.js; (2) only if that is too
 * sparse, OCR by Gemini in a truncation-safe
 * format with up to MAX_CALLS continuation calls. Never fabricates content: failures are
 * reported as `failed` / `partial`, not filled in.
 *
 * Body: { base64Data?, mimeType?, textContent?, fileName, sourceId, concepts: {id, name}[] }
 * Response: SlideSource (see src/types.ts)
 */
export const handleExtractSlides = async (req: Request, res: Response) => {
  const { base64Data, mimeType, textContent } = req.body ?? {};
  const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId : '';
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.slice(0, 300) : '';
  if (!sourceId || !fileName) {
    return res.status(400).json({ error: 'معرّف الملف واسمه مطلوبان.' });
  }

  if (isUnreadableOffice(fileName, mimeType)) {
    return res.json(failedSource(sourceId, fileName, MSG_OFFICE_UNSUPPORTED, 'unsupported'));
  }

  const concepts = readConcepts(req.body?.concepts);

  // Word files: converted to text here, then sectioned like any text upload.
  let plainText = typeof textContent === 'string' && !base64Data ? textContent : '';
  if (typeof base64Data === 'string' && base64Data && isDocx(fileName, mimeType)) {
    const docx = await docxToText(base64Data);
    if ('error' in docx) return res.json(failedSource(sourceId, fileName, docx.error));
    plainText = docx.text;
  }

  // Plain-text sources: deterministic, no model call.
  if (plainText.trim()) {
    const slides = sectionPlainText(plainText.slice(0, MAX_TEXT_INPUT_CHARS), concepts);
    const result = finalizeSource(sourceId, fileName, slides, plainText.length <= MAX_TEXT_INPUT_CHARS);
    return res.json(result);
  }

  if (typeof base64Data !== 'string' || !base64Data || typeof mimeType !== 'string') {
    return res.status(400).json({ error: 'لم يتم استلام ملف صالح لاستخراج الشرائح.' });
  }
  if (!(mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
    return res.json(failedSource(sourceId, fileName, MSG_UNSUPPORTED_MIME(mimeType), 'unsupported'));
  }

  const isPdf = mimeType === 'application/pdf';
  const buffer = Buffer.from(base64Data, 'base64');
  const diagnostic: ExtractionDiagnostic = {
    fileName,
    bytesRead: buffer.length,
    pageCount: null,
    pagesWithTextLayer: null,
    extractors: [],
  };

  // Step 1 (PDF only): the PDF's own text layer — instant and exact for any typed/exported PDF.
  let layerSlides: ParsedSlide[] = [];
  let layerComplete = false;
  let pdfFailure: PdfFailure | undefined;
  if (isPdf) {
    const layer = await extractPdfText(buffer);
    if ('reason' in layer) {
      pdfFailure = layer.reason;
      diagnostic.pageCount = layer.pageCount ?? null;
      diagnostic.extractors.push({
        name: 'pdf_text_layer',
        outcome: layer.reason === 'timeout' ? 'timeout' : 'failed',
        detail: layer.detail,
      });
      // OCR cannot read what is empty, not a PDF, locked or structurally broken: report it now
      // instead of spending the OCR budget. A slow text layer or an unavailable reader falls through to OCR.
      if (layer.reason !== 'timeout' && layer.reason !== 'unavailable') {
        return res.json(failedSource(sourceId, fileName, formatDiagnostic(diagnostic, layer.reason), 'failed', diagnostic));
      }
    } else {
      diagnostic.pageCount = layer.pageCount;
      diagnostic.pagesWithTextLayer = layer.pagesWithText;
      layerSlides = pageSlides(layer.pages, concepts);
      layerComplete = layer.pagesRead === layer.pageCount;
      if (textLayerIsUsable(layer)) {
        diagnostic.extractors.push({ name: 'pdf_text_layer', outcome: 'ok' });
        diagnostic.extractors.push({ name: 'gemini_ocr', outcome: 'skipped' });
        return res.json({ ...finalizeSource(sourceId, fileName, layerSlides, layerComplete), diagnostic });
      }
      diagnostic.extractors.push({
        name: 'pdf_text_layer',
        outcome: 'empty',
        detail: `${layer.pagesWithText} من ${layer.pagesRead} صفحة فيها نص`,
      });
    }
  }

  // Step 2: OCR (Gemini vision) — scanned PDFs, images, and PDFs whose text layer is too sparse.
  const allowed = new Set(concepts.map((c) => c.id));
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let slides: ParsedSlide[] = [];
  let complete = false;
  let ocrAnswered = false;
  let lastRaw = '';
  let ocrError: any = null;

  try {
    for (let call = 0; call < MAX_CALLS && !complete; call++) {
      const remaining = deadline - Date.now();
      if (remaining < 15000) break;

      const lastSlide = slides.length ? slides[slides.length - 1].slideIndex : undefined;
      const response = await generateWithRetry(
        {
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: buildExtractSlidesPrompt({ fileName, concepts, startAfterSlide: lastSlide }) },
            ],
          },
          config: {
            systemInstruction: SYSTEM_PROMPT,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0,
          },
        },
        Math.min(PER_CALL_TIMEOUT_MS, remaining)
      );

      ocrAnswered = true;
      lastRaw = String(response?.text || '');
      const parsed = parseTranscript(lastRaw, allowed);
      const before = slides.length;
      slides = mergeSlides(slides, parsed.slides);
      complete = parsed.complete;
      if (!complete && slides.length === before) break; // no progress — stop, report partial
    }
  } catch (err: any) {
    ocrError = err;
    if (slides.length > 0) {
      // A continuation failed after earlier slides arrived: keep them, report partial.
      console.warn(`[extract-slides] continuation failed for ${fileName}; keeping ${slides.length} slide(s)`);
    } else {
      console.error(`[extract-slides] OCR failed for ${fileName}: ${String(err?.message || err).slice(0, 300)}`);
    }
  }

  // The model answered with real text but ignored the slide format: keep the text, don't discard it.
  if (slides.length === 0 && ocrAnswered) {
    const loose = looseTranscript(lastRaw, concepts);
    if (loose.length) {
      slides = loose;
      complete = true;
    }
  }

  if (slides.length > 0) {
    diagnostic.extractors.push({ name: 'gemini_ocr', outcome: 'ok' });
    return res.json({ ...finalizeSource(sourceId, fileName, slides, complete), diagnostic });
  }

  diagnostic.extractors.push({
    name: 'gemini_ocr',
    ...(ocrError
      ? { outcome: /timed out/i.test(String(ocrError?.message)) ? 'timeout' : 'failed', detail: ocrErrorDetail(ocrError) }
      : ocrAnswered
        ? { outcome: 'empty' }
        : { outcome: 'timeout', detail: 'لم يبقَ وقت كافٍ للمحاولة' }),
  });

  // OCR got nothing, but the sparse text layer did have some pages: serve those, marked partial.
  if (layerSlides.length > 0) {
    return res.json({
      ...finalizeSource(sourceId, fileName, layerSlides, layerComplete, MSG_LAYER_ONLY(layerSlides.length, diagnostic.pageCount)),
      diagnostic,
    });
  }

  if (ocrError && isQuotaOrRateLimitError(ocrError)) {
    console.error(`[extract-slides] quota / rate limit: ${String(ocrError?.message || ocrError).slice(0, 300)}`);
    return res.status(429).json({
      error: 'تم استهلاك حصة الاستخدام المتاحة حالياً. أعد معالجة الشرائح لاحقاً.',
      isRateLimit: true,
      diagnostic,
    });
  }

  // Step 3: both failed — say exactly what was tried, never a bare "no readable text".
  return res.json(failedSource(sourceId, fileName, formatDiagnostic(diagnostic, pdfFailure), 'failed', diagnostic));
};

/** Refusals/apologies are not document text. */
const REFUSAL = /\b(cannot|can't|unable|sorry)\b|لا أستطيع|لا يمكنني|تعذر علي|عذراً/i;

/**
 * Text the OCR model returned outside the slide format. Accepted only when it is substantial
 * and not a refusal; it is then sectioned like any plain-text upload.
 */
export function looseTranscript(raw: string, concepts: ConceptRef[]): ParsedSlide[] {
  const text = raw
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```\s*$/, '')
    .replace(/^===.*===\s*$/gm, '')
    .replace(/^(KEYWORDS|CONCEPTS|UNREADABLE):.*$/gm, '')
    .replace(/^(TEXT|VISUAL):\s*/gm, '')
    .trim();
  if (meaningfulChars(text) < 80 || REFUSAL.test(text.slice(0, 200))) return [];
  return sectionPlainText(text.slice(0, MAX_TEXT_INPUT_CHARS), concepts);
}

const ocrErrorDetail = (err: any): string => {
  const status = err?.status ?? err?.code;
  if (/timed out/i.test(String(err?.message))) return 'لم يرد النموذج في الوقت المحدد';
  return status ? `خطأ من خدمة النموذج ${status}` : 'خطأ في الاتصال بخدمة النموذج';
};
