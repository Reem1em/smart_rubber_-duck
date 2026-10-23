/** Raw model text is capped in error messages so a runaway response can't flood the logs. */
const MAX_RAW_IN_MESSAGE = 500;

/** Thrown when a model response holds no parseable JSON; carries the raw text for logging. */
export class QuacklyParseError extends Error {
  readonly rawText: string;

  constructor(rawText: string, cause?: unknown) {
    const snippet = rawText.length > MAX_RAW_IN_MESSAGE ? `${rawText.slice(0, MAX_RAW_IN_MESSAGE)}…` : rawText;
    super(`Model response is not valid JSON (${rawText.length} chars): ${snippet}`);
    this.name = 'QuacklyParseError';
    this.rawText = rawText;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/** First object or array in the text; prose before or after it is dropped. */
const JSON_BLOCK = /\{[\s\S]*\}|\[[\s\S]*\]/;
/** Opening (```json, ```JSON, ```) and closing markdown fence markers, anywhere in the text. */
const FENCE = /```[a-zA-Z]*/g;

const FAILED = Symbol('parse-failed');

/** JSON.parse that records the last failure instead of throwing. */
function tryParse(text: string, failure: { error?: unknown }): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    failure.error = error;
    return FAILED;
  }
}

/**
 * Parses a model response into JSON, defaulting to an empty object for an empty body.
 *
 * Structured-output responses parse directly. Otherwise fences are stripped and the first
 * object/array is extracted, so "Sure! ```json {...} ``` Hope it helps" still parses.
 * Throws QuacklyParseError when nothing parseable remains.
 */
export function parseModelJson(text: string | undefined): any {
  const raw = (text ?? '').trim();
  if (!raw) return {};

  const failure: { error?: unknown } = {};
  const direct = tryParse(raw, failure);
  if (direct !== FAILED) return direct;

  // Extract from the untouched text first, so fences inside string values (e.g. code) survive;
  // strip fences only if that fails.
  const extracted = raw.match(JSON_BLOCK)?.[0];
  if (extracted) {
    const recovered = tryParse(extracted, failure);
    if (recovered !== FAILED) return recovered;
  }

  const unfenced = raw.replace(FENCE, '').trim();
  const stripped = (unfenced.match(JSON_BLOCK)?.[0] ?? unfenced).replace(FENCE, '').trim();
  const recovered = tryParse(stripped, failure);
  if (recovered !== FAILED) return recovered;
  throw new QuacklyParseError(raw, failure.error);
}

/** Kept for existing callers; parseModelJson now tolerates fences itself. */
export const parseModelJsonWithFences = parseModelJson;
