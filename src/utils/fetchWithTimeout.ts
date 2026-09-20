import { isRateLimitError } from './rateLimit';

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 180000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (response.status === 429) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.message || errData.error || 'RESOURCE_EXHAUSTED: Quota exceeded';
      const err = new Error(msg);
      (err as any).isRateLimit = true;
      (err as any).status = 429;
      throw err;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.message || errData.error || `HTTP ${response.status}: Failed request`;
      const err = new Error(msg);
      if (isRateLimitError(errData) || isRateLimitError(msg)) {
        (err as any).isRateLimit = true;
        (err as any).status = 429;
      }
      throw err;
    }

    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('انتهت مهلة انتظار الاستجابة. يرجى المحاولة مرة أخرى.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
