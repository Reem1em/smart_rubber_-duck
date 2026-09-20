import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildQuizPrompt } from '../prompts/generateQuiz';
import { quizSchema } from '../schemas/generateQuiz';
import { quizFallback } from '../fallbacks/generateQuiz';

export const handleGenerateQuiz = async (req: Request, res: Response) => {
  try {
    const { concept, studentExplanation, transferAnswer, materialContext } = req.body;

    const conceptName = concept?.name || 'المفهوم المدروس';
    const conceptSummary = concept?.summary || '';
    const keyPrinciples = Array.isArray(concept?.keyPrinciples) ? concept.keyPrinciples : [];
    const principlesText = keyPrinciples.join(' - ');

    const prompt = buildQuizPrompt({ conceptName, conceptSummary, principlesText, materialContext, studentExplanation, transferAnswer });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return res.json(parsed);
    }
    throw new Error('Invalid quiz response');
  } catch (err: any) {
    console.warn('Fallback triggered for generate-quiz:', err?.message || err);
    return res.json(quizFallback(req.body));
  }
};
