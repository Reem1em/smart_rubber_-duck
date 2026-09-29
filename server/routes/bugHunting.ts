import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildBugChallengePrompt, buildBugEvaluationPrompt } from '../prompts/bugHunting';
import { bugChallengeSchema, bugEvaluationSchema } from '../schemas/bugHunting';
import { bugChallengeFallback, bugEvaluationFallback } from '../fallbacks/bugHunting';
import { isStemTopic } from '../stem';

export const handleGenerateBugChallenge = async (req: Request, res: Response) => {
  try {
    const { language, difficulty } = req.body;
    const lang = language || 'جبر المصفوفات والمحددات';
    const diff = difficulty || 'Intermediate';

    const isMath = isStemTopic(lang);

    const prompt = buildBugChallengePrompt({ isMath, lang, diff });

    const response = await generateInteractive({
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
    return handleModelFailure(res, 'bug-hunting', err, () => bugChallengeFallback(req.body));
  }
};

export const handleEvaluateBugChallenge = async (req: Request, res: Response) => {
  try {
    const { buggyCode, userFixDescription, expectedBehavior, language } = req.body;

    const prompt = buildBugEvaluationPrompt({
      buggyCode,
      userFixDescription,
      expectedBehavior,
      isMath: isStemTopic(language, expectedBehavior, buggyCode),
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: bugEvaluationSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    return res.json(parsed);
  } catch (err: any) {
    return handleModelFailure(res, 'bug-hunting', err, () => bugEvaluationFallback());
  }
};
