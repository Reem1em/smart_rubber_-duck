import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildQuizPrompt } from '../prompts/generateQuiz';
import { quizSchema } from '../schemas/generateQuiz';
import { quizFallback } from '../fallbacks/generateQuiz';
import { isStemTopic } from '../stem';

export const handleGenerateQuiz = async (req: Request, res: Response) => {
  try {
    const { concept, studentExplanation, transferAnswer, materialContext } = req.body;

    const conceptName = concept?.name || 'المفهوم المدروس';
    const conceptSummary = concept?.summary || '';
    const keyPrinciples = Array.isArray(concept?.keyPrinciples) ? concept.keyPrinciples : [];
    const principlesText = keyPrinciples.join(' - ');

    const isStem = isStemTopic(conceptName, conceptSummary, keyPrinciples, materialContext);

    const prompt = buildQuizPrompt({ conceptName, conceptSummary, principlesText, materialContext, studentExplanation, transferAnswer, isStem });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      // Option notes power the instant answer feedback; keep them only when they line up 1:1 with the options.
      for (const q of parsed.questions) {
        const ok =
          Array.isArray(q?.optionNotes) &&
          Array.isArray(q?.options) &&
          q.optionNotes.length === q.options.length &&
          q.optionNotes.every((n: unknown) => typeof n === 'string' && n.trim());
        if (!ok) delete q.optionNotes;
      }
      return res.json(parsed);
    }
    throw new Error('Invalid quiz response');
  } catch (err: any) {
    return handleModelFailure(res, 'generate-quiz', err, () => quizFallback(req.body));
  }
};
