import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildBugChallengePrompt, buildBugEvaluationPrompt } from '../prompts/bugHunting';
import { bugChallengeSchema, bugEvaluationSchema } from '../schemas/bugHunting';
import { bugChallengeFallback, bugEvaluationFallback } from '../fallbacks/bugHunting';

export const handleGenerateBugChallenge = async (req: Request, res: Response) => {
  try {
    const { language, difficulty } = req.body;
    const lang = language || 'جبر المصفوفات والمحددات';
    const diff = difficulty || 'Intermediate';

    const isMath =
      lang.includes('مصفوف') ||
      lang.includes('جبر') ||
      lang.includes('تفاضل') ||
      lang.includes('تكامل') ||
      lang.includes('متجه') ||
      lang.includes('Algebra') ||
      lang.includes('Calculus') ||
      lang.includes('Vector') ||
      lang.includes('Math');

    const prompt = buildBugChallengePrompt({ isMath, lang, diff });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: bugChallengeSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (parsed.challenge && parsed.challenge.buggyCode) {
      return res.json(parsed);
    }
    throw new Error('Invalid bug challenge response');
  } catch (err: any) {
    console.warn('Fallback triggered for generate-bug-challenge:', err?.message || err);
    return res.json(bugChallengeFallback(req.body));
  }
};

export const handleEvaluateBugChallenge = async (req: Request, res: Response) => {
  try {
    const { buggyCode, userFixDescription, expectedBehavior } = req.body;

    const prompt = buildBugEvaluationPrompt({ buggyCode, userFixDescription, expectedBehavior });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: bugEvaluationSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    return res.json(parsed);
  } catch (err: any) {
    console.warn('Fallback triggered for evaluate-bug-challenge:', err?.message || err);
    return res.json(bugEvaluationFallback());
  }
};
