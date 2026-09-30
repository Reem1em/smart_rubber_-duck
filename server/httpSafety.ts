import type { ErrorRequestHandler, RequestHandler } from 'express';

/** Longest an /api request may stay open; the model layer's own budget is 150s. */
const API_RESPONSE_DEADLINE_MS = 170000;

const GENERIC_ERROR = 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة مرة أخرى.';

/**
 * Express 4 does not catch rejected promises from async handlers: the request hangs
 * and, on Node >= 15, the rejection can take down the whole process. Wrapping every
 * route forwards any throw / rejection to the JSON error handler below instead.
 */
export function safe(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

/** Guarantees every /api request gets a JSON answer, even if a handler never responds. */
export const apiResponseWatchdog: RequestHandler = (req, res, next) => {
  const timer = setTimeout(() => {
    if (res.headersSent) return;
    console.error(`[watchdog] ${req.method} ${req.originalUrl} had no response after ${API_RESPONSE_DEADLINE_MS}ms`);
    res.status(503).json({
      error: 'استغرق الطلب وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.',
      isServerOverload: true,
    });
  }, API_RESPONSE_DEADLINE_MS);
  const clear = () => clearTimeout(timer);
  res.on('finish', clear);
  res.on('close', clear);
  next();
};

/**
 * Final error handler: converts anything thrown in the stack (including body-parser's
 * 413 "payload too large" and malformed-JSON 400s) into a JSON response, never HTML.
 */
export const jsonErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const detail = status >= 500 ? err?.stack || err : err?.message || err;
  console.error(`[http] ${req.method} ${req.originalUrl} failed (HTTP ${status}):`, detail);
  if (res.headersSent) return next(err);

  const error =
    status === 413
      ? 'حجم الملف أكبر من الحد المسموح. جرّب ملفاً أصغر.'
      : status === 400 && err?.type === 'entity.parse.failed'
        ? 'تعذر قراءة بيانات الطلب.'
        : GENERIC_ERROR;
  res.status(status).json({ error });
};
