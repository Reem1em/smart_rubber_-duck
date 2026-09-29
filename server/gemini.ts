import { GoogleGenAI } from '@google/genai';

import { recordModelUsage } from './auth/quota';

/**
 * Tiered model routing.
 * - HEAVY: one-off, cached curriculum work (material analysis, syllabus parsing).
 * - INTERACTIVE: every real-time call (challenges, chat, answer evaluation) — the
 *   lightweight, high-availability models, so heavy traffic spikes don't block students.
 */
const HEAVY_MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const INTERACTIVE_MODEL_CHAIN = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
const DEFAULT_TIMEOUT_MS = 40000;
const INTERACTIVE_TIMEOUT_MS = 20000;
/** Silent retry schedule for interactive calls: 3 attempts, waiting 1.5s then 3s. */
const INTERACTIVE_BACKOFF_MS = [1500, 3000];

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
 * Retries the PRIMARY model (HEAVY_MODEL_CHAIN[0]) up to maxRetries times on 503 or 429
 * with exponential backoff (baseDelayMs * 2^attempt). Never falls back to a lighter
 * model — the primary model is preserved across all retries.
 */
export async function generateWithRetry(
  params: { contents: any; config?: any },
  customTimeoutMs?: number,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<any> {
  const model = HEAVY_MODEL_CHAIN[0];
  const timeoutMs = customTimeoutMs || DEFAULT_TIMEOUT_MS;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential back-off: 0ms, 2000ms, 4000ms, 8000ms
    if (attempt > 0) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[generateWithRetry] Attempt ${attempt}/${maxRetries} after ${delay}ms backoff (model: ${model})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      return await callModel(model, params, timeoutMs);
    } catch (err: any) {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Client-side request errors (bad prompt/schema, auth) fail identically on every retry. */
function isPermanentError(err: any): boolean {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 404 && status !== 408 && status !== 429;
}

/** One model call raced against a timeout; token usage is metered on success. */
async function callModel(model: string, params: { contents: any; config?: any }, timeoutMs: number): Promise<any> {
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

    const apiPromise = getClient().models.generateContent({ ...params, config: modelConfig, model });
    const result: any = await Promise.race([apiPromise, timeoutPromise]);
    await recordModelUsage(result?.usageMetadata?.totalTokenCount);
    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Real-time generation for challenges, chat and answer evaluation.
 * Up to 3 attempts with 1.5s / 3s back-off, rotating across the lightweight tier so a
 * 503 or 429 on one model is absorbed silently while the client stays in its loading state.
 */
export async function generateInteractive(params: { contents: any; config?: any }, customTimeoutMs?: number) {
  const timeoutMs = customTimeoutMs || INTERACTIVE_TIMEOUT_MS;
  const attempts = INTERACTIVE_BACKOFF_MS.length + 1;
  let lastError: any = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const model = INTERACTIVE_MODEL_CHAIN[attempt % INTERACTIVE_MODEL_CHAIN.length];
    try {
      return await callModel(model, params, timeoutMs);
    } catch (err: any) {
      lastError = err;
      if (isPermanentError(err) || attempt === attempts - 1) break;
      const delay = INTERACTIVE_BACKOFF_MS[attempt];
      console.warn(`[interactive] ${model} failed (${err?.status ?? 'error'}); retry ${attempt + 2}/${attempts} in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}
