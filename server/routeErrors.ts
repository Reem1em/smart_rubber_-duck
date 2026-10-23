import type { Response } from 'express';

import { isQuotaOrRateLimitError, isServerOverloadError } from './gemini';

/** Pulls the transport status off a Gemini SDK error, however it was wrapped. */
function statusOf(err: any): number | undefined {
  return err?.status ?? err?.statusCode ?? err?.response?.status;
}

/** Full error text, so the console shows the real API failure rather than a summary. */
function detailOf(err: any): string {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  return err.message || err.error?.message || JSON.stringify(err).slice(0, 800);
}

/**
 * Single exit point for a failed model call.
 *
 * Quota and rate-limit failures are propagated as a real 429 so the client's
 * RateLimitModal fires — masking them behind a cheerful offline payload told the
 * student the tutor was "unavailable" when they had simply run out of quota.
 * Server overload (after the model layer's silent retries) degrades to the route's
 * fallback flagged `degraded: true`, so an interactive submission never dead-ends on a
 * banner. Heavy, one-off routes pass `degradeOnOverload: false` to keep the 503, since a
 * canned syllabus or roadmap would be worse than an honest "try again".
 * Everything else also degrades to the fallback, and is logged in full.
 */
export function handleModelFailure(
  res: Response,
  context: string,
  err: any,
  fallback: () => object,
  { degradeOnOverload = true }: { degradeOnOverload?: boolean } = {}
) {
  const status = statusOf(err);
  const detail = detailOf(err);

  if (isServerOverloadError(err) && degradeOnOverload) {
    console.error(`[${context}] Gemini overload after retries (HTTP ${status ?? 503}); serving fallback: ${detail}`);
    return res.json({ ...fallback(), degraded: true });
  }

  if (isServerOverloadError(err)) {
    console.error(`[${context}] Gemini server overload (HTTP ${status ?? 503}): ${detail}`);
    return res.status(503).json({
      error:
        'خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً. يرجى المحاولة مرة أخرى.',
      isServerOverload: true,
      detail,
    });
  }

  if (isQuotaOrRateLimitError(err)) return sendRateLimit(res, context, status, detail);

  console.error(`[${context}] model call failed (HTTP ${status ?? 'n/a'}): ${detail}`);
  return res.json(fallback());
}

/** Real 429 so the client's RateLimitModal fires. */
function sendRateLimit(res: Response, context: string, status: number | undefined, detail: string) {
  console.error(`[${context}] Gemini quota / rate limit (HTTP ${status ?? 429}): ${detail}`);
  return res.status(429).json({
    error:
      'تم استهلاك حصة الاستخدام المتاحة من نموذج Gemini. انتظر حتى تتجدد الحصة أو فعّل الفوترة في مشروعك.',
    isRateLimit: true,
    detail,
  });
}

/** Body of every assessment failure; `message` is what the student sees. */
export const ASSESSMENT_UNAVAILABLE = {
  error: 'Service Unavailable',
  message: 'تعذر الاتصال بالخادم الذكي. لا يمكن تقييم الإجابة حالياً، يرجى المحاولة مرة أخرى.',
} as const;

/**
 * Exit point for a failed model call on an ASSESSMENT route (explanation diagnosis,
 * Socratic grading, quiz discussion, final report, code/bug evaluation).
 *
 * Never serves a canned payload: a hard-coded score, verdict or "passed" flag would be a
 * fabricated evaluation of work the model never saw. Quota errors keep their 429 so the
 * quota modal still fires; every other failure is an explicit 503.
 */
export function handleAssessmentFailure(res: Response, context: string, err: any) {
  const status = statusOf(err);
  const detail = detailOf(err);

  if (isQuotaOrRateLimitError(err)) return sendRateLimit(res, context, status, detail);

  console.error(`[${context}] assessment unavailable (HTTP ${status ?? 'n/a'}): ${detail}`);
  return res.status(503).json(ASSESSMENT_UNAVAILABLE);
}
