import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildDiagnosePrompt } from '../prompts/diagnose';
import { diagnoseSchema } from '../schemas/diagnose';
import { diagnoseFallback } from '../fallbacks/diagnose';
import { isStemTopic } from '../stem';

export const handleDiagnose = async (req: Request, res: Response) => {
  try {
    const { concept, studentExplanation, confidenceLevel, materialContext } = req.body;

    if (!concept || !studentExplanation) {
      return res.status(400).json({ error: 'يرجى تقديم المفهوم وشرح الطالب.' });
    }

    const isStem = isStemTopic(concept?.name, concept?.summary, concept?.keyPrinciples, materialContext);

    const prompt = buildDiagnosePrompt({ concept, studentExplanation, confidenceLevel, materialContext, isStem });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: diagnoseSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    return res.json(parsed);
  } catch (err: any) {
    return handleModelFailure(res, 'diagnose', err, () => diagnoseFallback(req.body));
  }
};
