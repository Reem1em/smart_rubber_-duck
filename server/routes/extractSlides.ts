import type { Request, Response } from 'express';
import { ThinkingLevel } from '@google/genai';

import { generateWithRetry, isQuotaOrRateLimitError } from '../gemini';
import { EXTRACT_SLIDES_SYSTEM_INSTRUCTION, buildExtractSlidesPrompt } from '../prompts/extractSlides';
import { mergeSlides, parseTranscript } from '../slides/parseTranscript';
import { buildSlideChunks, sectionPlainText, type ParsedSlide } from '../../src/services/slides/chunking';

/** Continuation calls per file when a transcript hits the model's output limit. */
const MAX_CALLS = 4;
const MAX_OUTPUT_TOKENS = 32768;
/** Whole-request model budget; the client waits up to 300s for this background call. */
const TOTAL_BUDGET_MS = 240000;
const PER_CALL_TIMEOUT_MS = 120000;
/** Storage guard: text beyond this is not stored and the source is marked partial. */
const MAX_SOURCE_CHARS = 3_000_000;
const MAX_TEXT_INPUT_CHARS = 2_000_000;

const UNSUPPORTED_EXT = /\.(docx?|pptx?)$/i;
const UNSUPPORTED_MIME = /(msword|officedocument|powerpoint|ms-excel)/i;

const MSG_UNSUPPORTED = 'هذا النوع من الملفات لا يمكن قراءة نصه حالياً. صدّر الملف بصيغة PDF ثم ارفعه من جديد.';
const MSG_TRUNCATED = (n: number) =>
  `تم استخراج نص الشرائح حتى الشريحة ${n} فقط؛ بقية الملف لم تُستخرج بعد. أعد المعالجة لاحقاً لإكمالها.`;
const MSG_UNREADABLE = (slides: number[]) =>
  `بعض الأجزاء غير مقروءة في الشرائح: ${slides.join('، ')}؛ لم يُخمَّن محتواها.`;
const MSG_FAILED = 'تعذّر استخراج نص الشرائح الآن. يمكنك إعادة المعالجة لاحقاً.';
const MSG_EMPTY = 'لم يُعثر على نص قابل للقراءة في الملف.';

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
  transcriptComplete: boolean
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
  const errors: string[] = [];
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

function failedSource(sourceId: string, fileName: string, error: string, status: 'failed' | 'unsupported' = 'failed') {
  return {
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
 * Extracts the full slide text of one uploaded file for the course chat. Text sources are
 * sectioned deterministically; PDFs and images are transcribed by Gemini in a truncation-safe
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

  if (UNSUPPORTED_EXT.test(fileName) || (typeof mimeType === 'string' && UNSUPPORTED_MIME.test(mimeType))) {
    return res.json(failedSource(sourceId, fileName, MSG_UNSUPPORTED, 'unsupported'));
  }

  const concepts = readConcepts(req.body?.concepts);

  // Plain-text sources: deterministic, no model call.
  if (typeof textContent === 'string' && textContent.trim() && !base64Data) {
    const slides = sectionPlainText(textContent.slice(0, MAX_TEXT_INPUT_CHARS), concepts);
    const result = finalizeSource(sourceId, fileName, slides, textContent.length <= MAX_TEXT_INPUT_CHARS);
    return res.json(result);
  }

  if (typeof base64Data !== 'string' || !base64Data || typeof mimeType !== 'string') {
    return res.status(400).json({ error: 'لم يتم استلام ملف صالح لاستخراج الشرائح.' });
  }
  if (!(mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
    return res.json(failedSource(sourceId, fileName, MSG_UNSUPPORTED, 'unsupported'));
  }

  const allowed = new Set(concepts.map((c) => c.id));
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let slides: ParsedSlide[] = [];
  let complete = false;

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
            systemInstruction: EXTRACT_SLIDES_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0,
          },
        },
        Math.min(PER_CALL_TIMEOUT_MS, remaining)
      );

      const parsed = parseTranscript(String(response?.text || ''), allowed);
      const before = slides.length;
      slides = mergeSlides(slides, parsed.slides);
      complete = parsed.complete;
      if (!complete && slides.length === before) break; // no progress — stop, report partial
    }
  } catch (err: any) {
    if (slides.length === 0) {
      if (isQuotaOrRateLimitError(err)) {
        console.error(`[extract-slides] quota / rate limit: ${String(err?.message || err).slice(0, 300)}`);
        return res.status(429).json({
          error: 'تم استهلاك حصة الاستخدام المتاحة حالياً. أعد معالجة الشرائح لاحقاً.',
          isRateLimit: true,
        });
      }
      console.error(`[extract-slides] failed for ${fileName}: ${String(err?.message || err).slice(0, 300)}`);
      return res.json(failedSource(sourceId, fileName, MSG_FAILED));
    }
    // A continuation failed after earlier slides arrived: keep them, report partial.
    console.warn(`[extract-slides] continuation failed for ${fileName}; keeping ${slides.length} slide(s)`);
  }

  return res.json(finalizeSource(sourceId, fileName, slides, complete));
};
