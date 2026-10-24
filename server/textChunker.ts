/**
 * Splits long course material into model-sized chunks so no section sits in the
 * "middle" of a huge prompt where the model tends to skip it.
 */

export interface TextChunk {
  /** 0-based position of the chunk in the document. */
  index: number;
  text: string;
  /**
   * The last section heading seen before this chunk started, when the chunk itself
   * doesn't open with one. Lets the model attribute mid-chapter text correctly.
   */
  carriedHeading?: string;
}

export interface ChunkOptions {
  /** Chunks are cut at a natural boundary no earlier than this many characters. */
  minChars?: number;
  /** Hard ceiling for a chunk's length. */
  maxChars?: number;
}

const DEFAULT_MIN_CHARS = 10_000;
const DEFAULT_MAX_CHARS = 12_000;

// Lines that open a structural division: markdown headings or "Chapter 3" / "الفصل الثالث" style labels.
const HEADING_LINE =
  /^[ \t]*(?:#{1,6}[ \t]+\S|(?:chapter|week|lecture|unit|section|part|module|lesson)[ \t]+[\dIVXivx]|(?:الفصل|الوحدة|الأسبوع|الاسبوع|المحاضرة|الباب|الدرس|القسم|الجزء)[ \t]+\S)/i;
const MAX_HEADING_LENGTH = 120;

// Blank line followed by a heading line.
const HEADING_AFTER_BLANK = new RegExp(String.raw`\n[ \t]*\n(?=` + HEADING_LINE.source.slice(1) + ')', 'gim');
// Any heading line.
const HEADING_START = new RegExp(String.raw`\n(?=` + HEADING_LINE.source.slice(1) + ')', 'gim');
const PARAGRAPH_BREAK = /\n[ \t]*\n/g;
const LINE_BREAK = /\n/g;
// Sentence end (Latin and Arabic punctuation).
const SENTENCE_END = /[.!?؟۔…](?=\s)/g;
const WHITESPACE = /\s/g;

/**
 * Structural boundaries (headings, paragraphs) are worth a shorter chunk, so they may reach
 * back to half the ceiling; weaker ones are only used inside the [minChars, maxChars] range.
 */
const STRUCTURAL_BOUNDARIES = [HEADING_AFTER_BLANK, HEADING_START, PARAGRAPH_BREAK];
const WEAK_BOUNDARIES = [LINE_BREAK, SENTENCE_END, WHITESPACE];

/** Index (relative to `window`) right after the last boundary match that ends within [from, window.length]. */
function lastBoundary(window: string, from: number, pattern: RegExp): number {
  pattern.lastIndex = 0;
  let best = -1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(window)) !== null) {
    const end = match.index + match[0].length;
    if (end >= from && end <= window.length) best = end;
    if (match[0].length === 0) pattern.lastIndex++;
  }
  return best;
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_HEADING_LENGTH && HEADING_LINE.test(trimmed);
}

/** The last heading line inside `text`, cleaned of markdown hashes. */
export function findLastHeading(text: string): string | undefined {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isHeading(lines[i])) return lines[i].trim().replace(/^#+\s*/, '');
  }
  return undefined;
}

function startsWithHeading(text: string): boolean {
  const firstLine = text.trimStart().split('\n', 1)[0] ?? '';
  return isHeading(firstLine);
}

/**
 * Splits `text` into chunks of roughly `minChars`–`maxChars` characters, cutting at the
 * strongest available boundary (heading > paragraph > line > sentence > whitespace).
 * Heading and paragraph breaks may produce a chunk as short as half of `maxChars`.
 * Falls back to a hard cut only for an unbroken run longer than `maxChars`.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS);
  const minChars = Math.min(options.minChars ?? DEFAULT_MIN_CHARS, maxChars);

  const chunks: TextChunk[] = [];
  let lastHeading: string | undefined;
  let start = 0;

  while (start < text.length) {
    let end: number;
    if (text.length - start <= maxChars) {
      end = text.length;
    } else {
      const window = text.slice(start, start + maxChars);
      const attempts: Array<[RegExp, number]> = [
        ...STRUCTURAL_BOUNDARIES.map((p): [RegExp, number] => [p, minChars]),
        ...STRUCTURAL_BOUNDARIES.map((p): [RegExp, number] => [p, Math.floor(maxChars / 2)]),
        ...WEAK_BOUNDARIES.map((p): [RegExp, number] => [p, minChars]),
        // Nothing natural in the preferred range: accept any whitespace break before the ceiling.
        [WHITESPACE, 1],
      ];
      let cut = -1;
      for (const [pattern, from] of attempts) {
        cut = lastBoundary(window, from, pattern);
        if (cut > 0) break;
      }
      end = start + (cut > 0 ? cut : maxChars);
    }

    const piece = text.slice(start, end).trim();
    if (piece) {
      chunks.push({
        index: chunks.length,
        text: piece,
        carriedHeading: lastHeading && !startsWithHeading(piece) ? lastHeading : undefined,
      });
      lastHeading = findLastHeading(piece) ?? lastHeading;
    }
    start = end;
  }

  return chunks;
}
