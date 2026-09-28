export const RATE_LIMIT_MESSAGE =
  'معليش! حد الاستخدام خلص حالياً 😅.. يرجى المحاولة لاحقاً، خذلك استراحة أو حاول تدرس وتراجع أكثر وبنرجع نركز سوا!';

export function isRateLimitError(err: any): boolean {
  if (!err) return false;
  if (err.isRateLimit || err.status === 429 || err.statusCode === 429) return true;
  const msg = String(err.message || err.error || err.statusText || err || '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('حد الاستخدام')
  );
}

export function isServerOverloadError(err: any): boolean {
  if (!err) return false;
  if (err.isServerOverload || err.status === 503 || err.statusCode === 503) return true;
  const msg = String(err.message || err.error || err.statusText || err || '');
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('overloaded') ||
    msg.includes('Service Unavailable') ||
    msg.includes('ضغطاً مؤقتاً')
  );
}
