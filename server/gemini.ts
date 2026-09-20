import { GoogleGenAI } from '@google/genai';

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

      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return result as any;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;
      console.warn(`Model ${model} failed (${err?.status || err?.statusCode || 'error'}: ${err?.message || err}). Retrying with next model...`);
    }
  }
  throw lastError;
}
