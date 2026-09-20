import type { Request, Response } from 'express';

export const handleHealth = (req: Request, res: Response) => {
  res.json({ status: 'ok' });
};
