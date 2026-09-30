import type { Request, Response } from 'express';

import { readGeminiApiKey } from '../gemini';

export const handleHealth = (req: Request, res: Response) => {
  res.json({ status: 'ok', geminiKeyConfigured: readGeminiApiKey() !== null });
};
