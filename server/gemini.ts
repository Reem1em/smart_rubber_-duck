import { GoogleGenAI } from '@google/genai';

import { recordModelUsage } from './auth/quota';

/**
 * Tiered model routing. Every call walks its chain in order; a transient failure on one
 * model (503 / 429 / 500 / timeout / retired model) falls through to the next model
 * immediately, and the whole chain is retried once more after a short pause.
 *
 * - HEAVY: one-off, cached curriculum work (material analysis, syllabus parsing).
 * - INTERACTIVE: every real-time call (challenges, chat, answer evaluation).
 *
 * Both chains end on the fast flash-lite model, which has the highest availability.
 * Override per deployment (models available differ per API key / project) with
 * comma-separated GEMINI_HEAVY_MODELS / GEMINI_FAST_MODELS.
 *
 * NOTE: gemini-2.5-* and gemini-1.5-* return 404 ("no longer available to new users")
 * for new API keys, so they must not be used as defaults.
 */
const DEFAULT_HEAVY_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];
const DEFAULT_INTERACTIVE_CHAIN = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

/** Per-call timeouts. Heavy calls parse up to 50k chars into a JSON schema, so they need longer. */
const HEAVY_TIMEOUT_MS = 45000;
const INTERACTIVE_TIMEOUT_MS = 15000;
/** Hard ceiling on one request's total model time — stays under the client's 180s abort. */
const HEAVY_BUDGET_MS = 150000;
const INTERACTIVE_BUDGET_MS = 60000;
/** Full passes over the chain, with a fixed pause between passes. */
const ROUNDS = 2;
const ROUND_DELAY_MS = 1500;

function chainFromEnv(name: string, fallback: string[]): string[] {
  const list = (process.env[name] || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length > 0 ? list : fallback;
}

/**
 * Reads GEMINI_API_KEY, tolerating the stray quotes / whitespace that dashboard env
 * editors (e.g. Render) often keep around a pasted value.
 */
export function readGeminiApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY;
  const key = raw?.trim().replace(/^["']|["']$/g, '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

/** Startup check: logs loudly instead of letting every request fail with a vague error. */
export function assertGeminiConfigured(): boolean {
  if (readGeminiApiKey()) {
    console.log(
      `[Gemini] API key loaded. Heavy chain: ${chainFromEnv('GEMINI_HEAVY_MODELS', DEFAULT_HEAVY_CHAIN).join(' → ')} | ` +
        `Interactive chain: ${chainFromEnv('GEMINI_FAST_MODELS', DEFAULT_INTERACTIVE_CHAIN).join(' → ')}`
    );
    return true;
  }
  console.error('[Gemini Error] GEMINI_API_KEY is missing!');
  return false;
}

let client: GoogleGenAI | null = null;

// Created lazily so dotenv.config() has always run before the API key is read.
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = readGeminiApiKey();
    if (!apiKey) {
      console.error('[Gemini Error] GEMINI_API_KEY is missing!');
      throw Object.assign(new Error('GEMINI_API_KEY is missing on the server.'), { status: 401 });
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function statusOf(err: any): number | undefined {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.code;
  return typeof status === 'number' ? status : undefined;
}

// Helper to check if error is API rate limit / quota exceeded (HTTP 429)
export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  if (statusOf(err) === 429) return true;
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
  if (statusOf(err) === 503) return true;
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
 * Failures worth trying another model for: overload, rate limit, server errors,
 * timeouts, network drops, and 404 (model retired / not enabled for this key).
 * Bad requests and auth failures (400/401/403) fail identically everywhere, so they don't.
 */
function isTransientError(err: any): boolean {
  if (isServerOverloadError(err) || isQuotaOrRateLimitError(err)) return true;
  const status = statusOf(err);
  if (status !== undefined) return status === 404 || status === 408 || status >= 500;
  const msg = String(err?.message || err || '');
  return /timed out|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|INTERNAL/i.test(msg);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One model call raced against a timeout; token usage is metered on success. */
async function callModel(model: string, params: { contents: any; config?: any }, timeoutMs: number): Promise<any> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(Object.assign(new Error(`Model ${model} timed out after ${timeoutMs}ms`), { status: 504 })),
        timeoutMs
      );
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
 * Walks `chain` for up to ROUNDS passes. Within a pass a transient failure falls through
 * to the next model with no delay; passes are separated by ROUND_DELAY_MS. The overall
 * budget caps worst-case latency. Permanent errors are thrown straight away.
 *
 * When all attempts fail, the error thrown is the most informative one: a 429 wins (so
 * the client shows the quota modal), then a 503, then the last error seen.
 */
async function generateAcrossChain(
  tag: string,
  chain: string[],
  params: { contents: any; config?: any },
  timeoutMs: number,
  budgetMs: number
): Promise<any> {
  const deadline = Date.now() + budgetMs;
  const errors: any[] = [];

  for (let round = 0; round < ROUNDS; round++) {
    if (round > 0) {
      if (Date.now() + ROUND_DELAY_MS >= deadline) break;
      console.warn(`[${tag}] all models failed; retrying chain in ${ROUND_DELAY_MS}ms (round ${round + 1}/${ROUNDS})`);
      await sleep(ROUND_DELAY_MS);
    }

    for (const model of chain) {
      const remaining = deadline - Date.now();
      if (remaining < 2000) break;
      try {
        const result = await callModel(model, params, Math.min(timeoutMs, remaining));
        if (errors.length > 0) console.warn(`[${tag}] recovered on ${model} after ${errors.length} failed attempt(s)`);
        return result;
      } catch (err: any) {
        errors.push(err);
        console.warn(`[${tag}] ${model} failed (HTTP ${statusOf(err) ?? 'n/a'}): ${String(err?.message || err).slice(0, 200)}`);
        if (!isTransientError(err)) throw err;
      }
    }
  }

  const final =
    errors.find(isQuotaOrRateLimitError) ??
    errors.find(isServerOverloadError) ??
    errors[errors.length - 1] ??
    Object.assign(new Error(`[${tag}] model time budget exhausted`), { status: 503 });
  console.error(`[${tag}] exhausted ${errors.length} attempt(s) across ${chain.join(', ')}`);
  throw final;
}

/** Heavy curriculum generation (material analysis, syllabus → roadmap). */
export async function generateWithRetry(params: { contents: any; config?: any }, customTimeoutMs?: number): Promise<any> {
  return generateAcrossChain(
    'heavy',
    chainFromEnv('GEMINI_HEAVY_MODELS', DEFAULT_HEAVY_CHAIN),
    params,
    customTimeoutMs || HEAVY_TIMEOUT_MS,
    HEAVY_BUDGET_MS
  );
}

/** Real-time generation for challenges, chat and answer evaluation. */
export async function generateInteractive(params: { contents: any; config?: any }, customTimeoutMs?: number) {
  return generateAcrossChain(
    'interactive',
    chainFromEnv('GEMINI_FAST_MODELS', DEFAULT_INTERACTIVE_CHAIN),
    params,
    customTimeoutMs || INTERACTIVE_TIMEOUT_MS,
    INTERACTIVE_BUDGET_MS
  );
}
