import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildDevChallengePrompt, buildDevEvaluationPrompt, DevLabMode } from '../prompts/devLab';
import { devChallengeSchema, devEvaluationSchema } from '../schemas/devLab';
import { devChallengeFallback, devEvaluationFallback } from '../fallbacks/devLab';

const normalizeMode = (raw: unknown): DevLabMode => (raw === 'bugHunter' ? 'bugHunter' : 'builder');

/** Dual-mode Code Lab challenge generator (Feature Builder / Bug-Hunter Lab). */
export const handleGenerateDevChallenge = async (req: Request, res: Response) => {
  try {
    const mode = normalizeMode(req.body?.mode);
    const language = req.body?.language || 'Python';
    const level = req.body?.level || 'Intermediate';

    const prompt = buildDevChallengePrompt({ mode, language, level });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: devChallengeSchema,
      },
    });

    const parsed = parseModelJson(response.text);

    // The model occasionally drops the mode or the snippet Bug-Hunter mode depends on.
    if (!parsed?.title) throw new Error('Invalid dev challenge response');
    if (mode === 'bugHunter' && !parsed.buggyCode) throw new Error('Bug-Hunter challenge missing code');

    return res.json({ ...parsed, mode, language, level });
  } catch (err: any) {
    return handleModelFailure(res, 'dev-lab', err, () => devChallengeFallback(req.body));
  }
};

/** Grades a Code Lab submission against correctness, edge cases and code quality. */
export const handleEvaluateDevSubmission = async (req: Request, res: Response) => {
  try {
    const mode = normalizeMode(req.body?.mode);
    const { language, level, challenge, studentCode, studentExplanation } = req.body || {};

    const prompt = buildDevEvaluationPrompt({
      mode,
      language: language || 'Python',
      level: level || 'Intermediate',
      challenge: challenge || '',
      studentCode: studentCode || '',
      studentExplanation,
    });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: devEvaluationSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed?.score !== 'number' || !parsed?.verdict) {
      throw new Error('Invalid dev evaluation response');
    }

    return res.json(parsed);
  } catch (err: any) {
    return handleModelFailure(res, 'dev-lab', err, () => devEvaluationFallback(req.body));
  }
};
