import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildProjectReviewPrompt } from '../prompts/reviewProject';
import { projectReviewSchema } from '../schemas/reviewProject';
import { projectReviewFallback } from '../fallbacks/reviewProject';

export const handleReviewProject = async (req: Request, res: Response) => {
  try {
    const { subjectName, codeSnippet, projectRequest, studentLevel } = req.body;

    const prompt = buildProjectReviewPrompt({ subjectName, codeSnippet, projectRequest, studentLevel });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: projectReviewSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed.score === 'number' && parsed.summary && Array.isArray(parsed.strengths)) {
      return res.json(parsed);
    }
    throw new Error('Invalid project review response structure');
  } catch (err: any) {
    console.warn('Fallback triggered for review-project:', err?.message || err);
    return res.json(projectReviewFallback(req.body));
  }
};
