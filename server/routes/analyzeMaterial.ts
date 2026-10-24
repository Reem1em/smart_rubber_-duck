import type { Request, Response } from 'express';
import { ThinkingLevel } from '@google/genai';

import { generateWithRetry, isServerOverloadError } from '../gemini';
import { mergeChunkModules, toRawModules, type RawModule } from '../materialMerge';
import { parseModelJsonWithFences } from '../modelJson';
import { buildSystemPrompt } from '../utils/loadAgent';
import {
  EXTRACTION_INSTRUCTIONS,
  buildDocumentChunkPrompt,
  buildDocumentTextPrompt,
} from '../prompts/analyzeMaterial';
import { analyzeMaterialSchema } from '../schemas/analyzeMaterial';
import { chunkText } from '../textChunker';

const SYSTEM_PROMPT = buildSystemPrompt('01_ANALYZER.md', '02_STRUCTURER.md');

const MAX_TEXT_CHARS = 50_000;
/** Texts at or above this length are split and analyzed chunk by chunk (map-reduce). */
const CHUNKING_THRESHOLD_CHARS = 15_000;
/** Parallel model calls per request; keeps a 50k-char document to two waves without tripping rate limits. */
const CHUNK_CONCURRENCY = 3;
const ANALYZE_TIMEOUT_MS = 45_000;

/** One structured extraction call; returns the modules the model found in `parts`. */
async function extractModules(parts: any[]): Promise<RawModule[]> {
  const response = await generateWithRetry({
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: analyzeMaterialSchema,
    },
  }, ANALYZE_TIMEOUT_MS);

  return toRawModules(parseModelJsonWithFences(response.text).modules);
}

/** Runs `worker` over `items` with at most `limit` in flight, preserving input order in the result. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Long texts are analyzed per chunk so concepts in the middle of the document get the
 * model's full attention, then merged. A failed chunk fails the whole request rather
 * than silently returning a course with a missing chapter.
 */
async function extractModulesFromText(text: string): Promise<RawModule[]> {
  if (text.length < CHUNKING_THRESHOLD_CHARS) {
    return extractModules([{ text: buildDocumentTextPrompt(text) }]);
  }

  const chunks = chunkText(text);
  const perChunk = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
    extractModules([{ text: buildDocumentChunkPrompt(chunk.text, chunk.index, chunks.length, chunk.carriedHeading) }])
  );
  return mergeChunkModules(perChunk);
}

export const handleAnalyzeMaterial = async (req: Request, res: Response) => {
  try {
    const { textContent, base64Data, mimeType, fileName } = req.body;

    if ((!textContent || !textContent.trim()) && !base64Data) {
      return res.status(400).json({ error: 'لم يتم استلام أي نص أو مستند دراسي صالح للتحليل.' });
    }

    let modules: RawModule[];

    if (base64Data && mimeType) {
      modules = await extractModules([
        { inlineData: { mimeType, data: base64Data } },
        { text: EXTRACTION_INSTRUCTIONS },
      ]);
    } else {
      const safeText = typeof textContent === 'string' ? textContent.trim().slice(0, MAX_TEXT_CHARS) : '';
      if (safeText.length < 15) {
        return res.status(400).json({ error: 'المحتوى الدراسي المرسل قصير جداً. يرجى توفير مادة علمية واضحة للتحليل.' });
      }
      modules = await extractModulesFromText(safeText);
    }

    if (modules.length === 0) {
      throw new Error('لم يتمكن النموذج من استخراج وحدات المنهج من المستند المرفق.');
    }

    const allConcepts: any[] = [];
    const markdownLines: string[] = [];

    modules.forEach((mod, modIdx) => {
      const modTitle = (mod.title || `الوحدة ${modIdx + 1}`).trim();
      const formattedTitle = modTitle.startsWith('[') ? modTitle : `[${modTitle}]`;
      markdownLines.push(`## ${modTitle}`);

      const modConcepts = mod.concepts ?? [];
      modConcepts.forEach((c, cIdx) => {
        const conceptName = (c.name || `مفهوم ${cIdx + 1}`).trim();
        const coreFocus = (c.coreFocus || c.summary || 'شرح وتطبيق المفهوم').trim();
        markdownLines.push(`* مفهوم ${cIdx + 1}: [${conceptName}] - [${coreFocus}]`);

        const slug = `mod-${modIdx + 1}-concept-${cIdx + 1}-${conceptName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;

        allConcepts.push({
          id: slug,
          chapterOrUnit: formattedTitle,
          name: conceptName,
          coreFocus: coreFocus,
          summary: c.summary || coreFocus,
          keyPrinciples: Array.isArray(c.keyPrinciples) && c.keyPrinciples.length > 0 
            ? c.keyPrinciples 
            : [coreFocus],
          difficulty: c.difficulty === 'متقدم' ? 'advanced' : c.difficulty === 'بسيط' ? 'basic' : 'intermediate'
        });
      });

      markdownLines.push('');
    });

    if (allConcepts.length === 0) {
      throw new Error('لم يتم العثور على مفاهيم تفصيلية قابلة للدراسة داخل المستند.');
    }

    return res.json({
      concepts: allConcepts,
      scopeType: modules.length > 1 ? 'full_course' : 'single_chapter',
      formattedBreakdown: markdownLines.join('\n').trim(),
    });
  } catch (err: any) {
    console.error('Error in analyze-material endpoint:', err?.message || err);
    if (isServerOverloadError(err)) {
      return res.status(503).json({
        error: 'خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً. يرجى المحاولة مرة أخرى.',
        isServerOverload: true,
      });
    }
    return res.status(500).json({
      error: err?.message || 'تعذر استخراج الهيكلية الأكاديمية والمفاهيم من المستند. يرجى التأكد من وضوح محتوى الملف والمحاولة مرة أخرى.'
    });
  }
};
