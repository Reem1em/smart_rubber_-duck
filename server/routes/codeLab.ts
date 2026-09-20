import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildCodeLabPrompt } from '../prompts/codeLab';
import { codeLabSchema } from '../schemas/codeLab';
import { codeLabFallback } from '../fallbacks/codeLab';

export const handleGenerateCodeLab = async (req: Request, res: Response) => {
  try {
    const { language, topic } = req.body;
    const lang = language || 'Java / Python / C++';
    const top = topic || 'Software Engineering / Computer Science Concepts';

    const prompt = buildCodeLabPrompt({ lang, top });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: codeLabSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (Array.isArray(parsed.projects) && parsed.projects.length === 3) {
      return res.json(parsed);
    }
    throw new Error('Invalid code lab response structure');
  } catch (err: any) {
    console.warn('Fallback triggered for generate-code-lab:', err?.message || err);
    return res.json(codeLabFallback());
  }
};
