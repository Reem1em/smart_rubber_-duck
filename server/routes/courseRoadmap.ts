import type { Request, Response } from 'express';
import { ThinkingLevel } from '@google/genai';

import { generateWithRetry } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJsonWithFences } from '../modelJson';
import {
  COURSE_ROADMAP_SYSTEM_INSTRUCTION,
  buildSyllabusDocumentPrompt,
  buildSyllabusTextPrompt,
} from '../prompts/courseRoadmap';
import { courseRoadmapSchema } from '../schemas/courseRoadmap';
import { courseRoadmapFallback } from '../fallbacks/courseRoadmap';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mode A of "خريطة المقرر": parses an official course specification into a
 * chronological week-by-week schedule with milestones and grade weights.
 * The client caches the result on the course, so this runs once per syllabus.
 */
export const handleParseSyllabus = async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType, textContent, conceptNames, courseName, todayIso } = req.body || {};

    if ((!textContent || !String(textContent).trim()) && !base64Data) {
      return res
        .status(400)
        .json({ error: 'لم يتم استلام توصيف المادة. أرفق ملف التوصيف (PDF) أو ألصق نصه.' });
    }

    const promptInput = {
      conceptNames: Array.isArray(conceptNames)
        ? conceptNames.map((n: unknown) => String(n)).filter(Boolean)
        : [],
      todayIso: ISO_DATE.test(String(todayIso)) ? String(todayIso) : new Date().toISOString().slice(0, 10),
      courseName: typeof courseName === 'string' ? courseName : undefined,
    };

    const parts: any[] = [];

    if (base64Data && mimeType) {
      parts.push({ inlineData: { mimeType, data: base64Data } });
      parts.push({ text: buildSyllabusDocumentPrompt(promptInput) });
    } else {
      const safeText = String(textContent).trim();
      if (safeText.length < 30) {
        return res
          .status(400)
          .json({ error: 'نص التوصيف قصير جداً. ألصق الجدول الأسبوعي وتوزيع الدرجات كاملاً.' });
      }
      parts.push({ text: buildSyllabusTextPrompt(promptInput, safeText) });
    }

    const response = await generateWithRetry(
      {
        contents: { parts },
        config: {
          systemInstruction: COURSE_ROADMAP_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: courseRoadmapSchema,
        },
      },
      45000
    );

    const parsed = parseModelJsonWithFences(response.text);

    const weeks = Array.isArray(parsed?.weeks) ? parsed.weeks : [];
    if (weeks.length === 0) {
      throw new Error('لم يتمكن النموذج من استخراج الجدول الأسبوعي من التوصيف.');
    }

    return res.json({
      ...parsed,
      weeks,
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
    });
  } catch (err: any) {
    return handleModelFailure(res, 'course-roadmap', err, () => courseRoadmapFallback(req.body));
  }
};
