import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildSlidesPrompt } from '../prompts/generateSlides';
import { slidesSchema } from '../schemas/generateSlides';
import { slidesFallback } from '../fallbacks/generateSlides';

export const handleGenerateSlides = async (req: Request, res: Response) => {
  try {
    const { concept, materialContext } = req.body;

    const conceptName = concept?.name || 'المفهوم التعليمي';
    const conceptSummary = concept?.summary || '';
    const keyPrinciples = concept?.keyPrinciples || [];

    const prompt = buildSlidesPrompt({ conceptName, conceptSummary, keyPrinciples, materialContext });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: slidesSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (parsed.presentationTitle && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      return res.json(parsed);
    }
    throw new Error('Invalid slide response structure from model');
  } catch (err: any) {
    return handleModelFailure(res, 'generate-slides', err, () => slidesFallback(req.body));
  }
};
