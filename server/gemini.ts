import { GoogleGenAI } from '@google/genai';

import { recordModelUsage } from './auth/quota';

/** Tried in order; each model falls through to the next on error, quota or timeout. */
const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const DEFAULT_TIMEOUT_MS = 40000;

let client: GoogleGenAI | null = null;

// Created lazily so dotenv.config() has always run before the API key is read.
function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return client;
}

// Helper to check if error is API rate limit / quota exceeded (HTTP 429)
export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.statusCode || err?.response?.status;
  if (status === 429) return true;
  const msg = String(err?.message || err?.error || err || '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  );
}

// Helper to check if error is a 503 server overload / model unavailability
export function isServerOverloadError(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.statusCode || err?.response?.status;
  if (status === 503) return true;
  const msg = String(err?.message || err?.error || err || '');
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('overloaded') ||
    msg.includes('Service Unavailable') ||
    msg.includes('model is overloaded')
  );
}

/**
 * Retries the PRIMARY model (MODEL_CHAIN[0]) up to maxRetries times on 503 or 429
 * with exponential backoff (baseDelayMs * 2^attempt). Never falls back to a lighter
 * model — the primary model is preserved across all retries.
 */
export async function generateWithRetry(
  params: { contents: any; config?: any },
  customTimeoutMs?: number,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<any> {
  const model = MODEL_CHAIN[0];
  const timeoutMs = customTimeoutMs || DEFAULT_TIMEOUT_MS;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential back-off: 0ms, 2000ms, 4000ms, 8000ms
    if (attempt > 0) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[generateWithRetry] Attempt ${attempt}/${maxRetries} after ${delay}ms backoff (model: ${model})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      });

      const modelConfig = params.config ? { ...params.config } : undefined;

      const apiPromise = getClient().models.generateContent({
        ...params,
        config: modelConfig,
        model,
      });

      const result: any = await Promise.race([apiPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      await recordModelUsage(result?.usageMetadata?.totalTokenCount);
      return result;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;

      const isRetriable = isServerOverloadError(err) || isQuotaOrRateLimitError(err);
      if (!isRetriable || attempt >= maxRetries) {
        // Non-retriable error or all retries exhausted
        console.error(
          `[generateWithRetry] Failed after ${attempt + 1} attempt(s) (${err?.status || 'error'}): ${err?.message || err}`
        );
        throw err;
      }
      console.warn(
        `[generateWithRetry] Retriable error (attempt ${attempt + 1}/${maxRetries + 1}, ` +
          `HTTP ${err?.status || err?.statusCode || 'n/a'}): ${err?.message || err}`
      );
    }
  }
  throw lastError;
}

// Attempts model execution with automatic fallback on rate limit/quota or model unavailability
export async function generateWithFallback(params: { contents: any; config?: any }, customTimeoutMs?: number) {
  let lastError: any = null;
  const timeoutMs = customTimeoutMs || DEFAULT_TIMEOUT_MS;

  for (const model of MODEL_CHAIN) {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const modelConfig = params.config ? { ...params.config } : undefined;
      // thinkingConfig is only supported on Gemini 3 series models
      if (modelConfig && !model.startsWith('gemini-3') && modelConfig.thinkingConfig) {
        delete modelConfig.thinkingConfig;
      }

      const apiPromise = getClient().models.generateContent({
        ...params,
        config: modelConfig,
        model,
      });

      const result: any = await Promise.race([apiPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      await recordModelUsage(result?.usageMetadata?.totalTokenCount);
      return result;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;
      console.warn(`Model ${model} failed (${err?.status || err?.statusCode || 'error'}: ${err?.message || err}). Retrying with next model...`);
    }
  }
  throw lastError;
}
