/**
 * Slide → retrievable chunk conversion. Lossless: a long slide is split into several
 * linked parts and joining the parts reproduces the slide text exactly.
 *
 * Pure module: used by the server (extraction) and covered by unit tests.
 */
import type { SlideChunk } from '../../types';
import { bigrams, contentTokens } from './normalize';

export const SLIDE_PART_CHARS = 1200;

/** A transcribed slide before it is split into parts. */
export interface ParsedSlide {
  slideIndex: number;
  heading: string;
  text: string;
  visual?: string;
  keywords: string[];
  conceptIds: string[];
  incomplete?: boolean;
}

/** Index just past the last match of `re` whose end lies in [min, max], or -1. */
function lastBoundary(window: string, re: RegExp, min: number): number {
  let best = -1;
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = global.exec(window)) !== null) {
    const end = m.index + m[0].length;
    if (end >= min) best = end;
    if (m[0].length === 0) global.lastIndex++;
  }
  return best;
}

/**
 * Splits slide text into parts of at most `max` characters, preferring paragraph, then
 * line, then sentence, then word boundaries. Hard-splits only an unbroken run.
 * Invariant: `splitSlideText(t).join('') === t`.
 */
export function splitSlideText(text: string, max: number = SLIDE_PART_CHARS): string[] {
  if (text.length <= max) return [text];

  const parts: string[] = [];
  let rest = text;
  const min = Math.floor(max * 0.4);

  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = lastBoundary(window, /\n\s*\n/, min);
    if (cut < 0) cut = lastBoundary(window, /\n/, min);
    if (cut < 0) cut = lastBoundary(window, /[.!?؟。;؛]\s+/, min);
    if (cut < 0) cut = lastBoundary(window, /\s+/, min);
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}

/** Expands parsed slides into uniquely identified, linked chunks. */
export function buildSlideChunks(sourceId: string, slides: ParsedSlide[]): SlideChunk[] {
  const chunks: SlideChunk[] = [];
  for (const slide of slides) {
    const parts = splitSlideText(slide.text);
    parts.forEach((text, i) => {
      chunks.push({
        id: `${sourceId}#s${slide.slideIndex}p${i + 1}`,
        slideIndex: slide.slideIndex,
        part: i + 1,
        partCount: parts.length,
        heading: slide.heading,
        text,
        ...(i === 0 && slide.visual ? { visual: slide.visual } : {}),
        keywords: slide.keywords,
        conceptIds: slide.conceptIds,
        ...(slide.incomplete ? { incomplete: true } : {}),
      });
    });
  }
  return chunks;
}

const HEADING_LINE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const SECTION_TARGET_CHARS = SLIDE_PART_CHARS;

/**
 * True when every content token of `name` appears in `text` (loose match), or a
 * name bigram does. Used to link text sections to concepts without a model call.
 */
export function mentionsConcept(text: string, name: string): boolean {
  const nameTokens = contentTokens(name);
  if (nameTokens.length === 0) return false;
  const textTokens = contentTokens(text);
  const looseSet = new Set(textTokens.map((t) => t.loose));
  if (nameTokens.every((t) => looseSet.has(t.loose))) return true;
  const textBigrams = new Set(bigrams(textTokens));
  return bigrams(nameTokens).some((b) => textBigrams.has(b));
}

/**
 * Deterministic "slides" for a plain-text source: sections under markdown headings, or
 * paragraph groups of about one part each when there are no headings. No text is dropped.
 */
export function sectionPlainText(
  raw: string,
  concepts: Array<{ id: string; name: string }>
): ParsedSlide[] {
  const text = raw.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const sections: Array<{ heading: string; body: string }> = [];
  let current: { heading: string; body: string[] } | null = null;
  const hasHeadings = lines.some((l) => HEADING_LINE.test(l));

  if (hasHeadings) {
    for (const line of lines) {
      const m = line.match(HEADING_LINE);
      if (m) {
        if (current) sections.push({ heading: current.heading, body: current.body.join('\n') });
        current = { heading: m[1].trim(), body: [] };
      } else {
        if (!current) current = { heading: '', body: [] };
        current.body.push(line);
      }
    }
    if (current) sections.push({ heading: current.heading, body: current.body.join('\n') });
  } else {
    const paragraphs = text.split(/\n\s*\n/);
    let buf: string[] = [];
    let len = 0;
    for (const p of paragraphs) {
      if (len > 0 && len + p.length > SECTION_TARGET_CHARS) {
        sections.push({ heading: '', body: buf.join('\n\n') });
        buf = [];
        len = 0;
      }
      buf.push(p);
      len += p.length + 2;
    }
    if (buf.length) sections.push({ heading: '', body: buf.join('\n\n') });
  }

  return sections
    .filter((s) => s.heading.trim() || s.body.trim())
    .map((s, i) => {
      const body = s.body.trim();
      const heading = s.heading || body.split('\n')[0].slice(0, 80);
      const haystack = `${heading}\n${body}`;
      const keywords = Array.from(new Set(contentTokens(heading).map((t) => t.primary))).slice(0, 12);
      return {
        slideIndex: i + 1,
        heading,
        text: body,
        keywords,
        conceptIds: concepts.filter((c) => mentionsConcept(haystack, c.name)).map((c) => c.id),
      };
    });
}
