import type { Request, Response } from 'express';
import { ThinkingLevel } from '@google/genai';

import { generateWithRetry, isServerOverloadError } from '../gemini';
import { parseModelJsonWithFences } from '../modelJson';
import { ANALYZE_MATERIAL_SYSTEM_INSTRUCTION, EXTRACTION_INSTRUCTIONS, buildDocumentTextPrompt } from '../prompts/analyzeMaterial';
import { analyzeMaterialSchema } from '../schemas/analyzeMaterial';

export const handleAnalyzeMaterial = async (req: Request, res: Response) => {
  try {
    const { textContent, base64Data, mimeType, fileName } = req.body;

    if ((!textContent || !textContent.trim()) && !base64Data) {
      return res.status(400).json({ error: 'لم يتم استلام أي نص أو مستند دراسي صالح للتحليل.' });
    }

    let contentsParts: any[] = [];

    if (base64Data && mimeType) {
      contentsParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
      contentsParts.push({
        text: EXTRACTION_INSTRUCTIONS,
      });
    } else {
      const safeText = typeof textContent === 'string' ? textContent.trim().slice(0, 50000) : '';
      if (safeText.length < 15) {
        return res.status(400).json({ error: 'المحتوى الدراسي المرسل قصير جداً. يرجى توفير مادة علمية واضحة للتحليل.' });
      }
      contentsParts.push({
        text: buildDocumentTextPrompt(safeText),
      });
    }

    const response = await generateWithRetry({
      contents: { parts: contentsParts },
      config: {
        systemInstruction: ANALYZE_MATERIAL_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: analyzeMaterialSchema,
      },
    }, 45000);

    const parsed = parseModelJsonWithFences(response.text);

    const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
    if (modules.length === 0) {
      throw new Error('لم يتمكن النموذج من استخراج وحدات المنهج من المستند المرفق.');
    }

    const allConcepts: any[] = [];
    const markdownLines: string[] = [];

    modules.forEach((mod: any, modIdx: number) => {
      const modTitle = (mod.title || `الوحدة ${modIdx + 1}`).trim();
      const formattedTitle = modTitle.startsWith('[') ? modTitle : `[${modTitle}]`;
      markdownLines.push(`## ${modTitle}`);

      const modConcepts = Array.isArray(mod.concepts) ? mod.concepts : [];
      modConcepts.forEach((c: any, cIdx: number) => {
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
