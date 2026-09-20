import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildSocraticEvalPrompt } from '../prompts/socraticEval';
import { socraticEvalSchema } from '../schemas/socraticEval';
import { socraticEvalFallback } from '../fallbacks/socraticEval';

export const handleSocraticEval = async (req: Request, res: Response) => {
  try {
    const { concept, initialExplanation, socraticQuestion, socraticAnswer } = req.body;

    const prompt = buildSocraticEvalPrompt({ concept, initialExplanation, socraticQuestion, socraticAnswer });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: socraticEvalSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    return res.json(parsed);
  } catch (err: any) {
    console.warn('Fallback triggered for socratic-eval:', err?.message || err);
    return res.json(socraticEvalFallback());
  }
};
