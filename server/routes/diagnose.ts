import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildDiagnosePrompt } from '../prompts/diagnose';
import { diagnoseSchema } from '../schemas/diagnose';
import { diagnoseFallback } from '../fallbacks/diagnose';

export const handleDiagnose = async (req: Request, res: Response) => {
  try {
    const { concept, studentExplanation, confidenceLevel, materialContext } = req.body;

    if (!concept || !studentExplanation) {
      return res.status(400).json({ error: 'يرجى تقديم المفهوم وشرح الطالب.' });
    }

    const prompt = buildDiagnosePrompt({ concept, studentExplanation, confidenceLevel, materialContext });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: diagnoseSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    return res.json(parsed);
  } catch (err: any) {
    console.warn('Fallback triggered for diagnose:', err?.message || err);
    return res.json(diagnoseFallback(req.body));
  }
};
