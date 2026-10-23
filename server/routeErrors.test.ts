import { describe, expect, it, vi } from 'vitest';

vi.mock('./gemini', () => ({
  isQuotaOrRateLimitError: (err: any) => err?.status === 429,
  isServerOverloadError: (err: any) => err?.status === 503,
}));

import { ASSESSMENT_UNAVAILABLE, handleAssessmentFailure } from './routeErrors';

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (b: any) => ((res.body = b), res);
  return res;
}

describe('handleAssessmentFailure', () => {
  it('answers an explicit 503 instead of a fabricated evaluation', () => {
    for (const err of [new Error('fetch failed'), { status: 503 }, { status: 500 }]) {
      const res: any = handleAssessmentFailure(mockRes(), 'test', err);
      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual(ASSESSMENT_UNAVAILABLE);
    }
  });

  it('keeps quota errors as 429 so the rate-limit modal fires', () => {
    const res: any = handleAssessmentFailure(mockRes(), 'test', { status: 429 });
    expect(res.statusCode).toBe(429);
    expect(res.body.isRateLimit).toBe(true);
  });
});
