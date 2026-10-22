/**
 * Parser for the delimited slide-transcript format produced by the extraction prompt.
 *
 * The format is plain text rather than JSON so that a response cut off by the model's
 * output limit still yields every slide block that arrived complete.
 *
 *   === SLIDE 7 | heading ===
 *   KEYWORDS: a; b; c
 *   CONCEPTS: id1, id2
 *   TEXT:
 *   ...
 *   VISUAL:
 *   ...
 *   UNREADABLE: no
 *   === END SLIDE ===
 *   === END OF DOCUMENT ===
 */
import type { ParsedSlide } from '../../src/services/slides/chunking';

export const END_OF_DOCUMENT = '=== END OF DOCUMENT ===';

const BLOCK = /===\s*SLIDE\s+(\d+)\s*(?:\|\s*([^\n]*?))?\s*===\s*\n([\s\S]*?)\n\s*===\s*END SLIDE\s*===/g;
const MAX_KEYWORDS = 12;

export interface TranscriptParse {
  slides: ParsedSlide[];
  /** The end-of-document marker was present. */
  complete: boolean;
  /** Highest slide index parsed, or null if none. */
  lastSlide: number | null;
}

/** Content of a `LABEL:` section up to the next known label (or end of block). */
function section(body: string, label: string): string | null {
  const labels = ['KEYWORDS', 'CONCEPTS', 'TEXT', 'VISUAL', 'UNREADABLE'];
  const re = new RegExp(`^${label}:[ \\t]*`, 'm');
  const m = re.exec(body);
  if (!m) return null;
  const start = m.index + m[0].length;
  const others = labels.filter((l) => l !== label).map((l) => new RegExp(`^${l}:`, 'm'));
  let end = body.length;
  for (const o of others) {
    const om = o.exec(body.slice(start));
    if (om) end = Math.min(end, start + om.index);
  }
  return body.slice(start, end).replace(/^\n/, '').replace(/\s+$/, '');
}

function isUnreadable(value: string | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return /^(yes|نعم|true)/.test(v);
}

const NONE_VALUES = /^(none|no|n\/a|لا يوجد|لا|-|—)?$/i;

export function parseTranscript(raw: string, allowedConceptIds: Set<string>): TranscriptParse {
  const text = (raw || '').replace(/\r\n?/g, '\n').replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '');
  const slides: ParsedSlide[] = [];
  const seen = new Set<number>();

  let m: RegExpExecArray | null;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(text)) !== null) {
    const slideIndex = Number(m[1]);
    if (!Number.isInteger(slideIndex) || slideIndex < 1 || seen.has(slideIndex)) continue;
    seen.add(slideIndex);

    const body = m[3];
    const keywords = (section(body, 'KEYWORDS') || '')
      .split(/[;؛,،\n]/)
      .map((k) => k.trim())
      .filter((k) => k && !NONE_VALUES.test(k))
      .slice(0, MAX_KEYWORDS);
    const conceptIds = (section(body, 'CONCEPTS') || '')
      .split(/[,،;\s]+/)
      .map((c) => c.trim())
      .filter((c) => allowedConceptIds.has(c));
    const visualRaw = section(body, 'VISUAL');
    const visual = visualRaw && !NONE_VALUES.test(visualRaw.trim()) ? visualRaw : undefined;
    const unreadable = isUnreadable(section(body, 'UNREADABLE'));

    slides.push({
      slideIndex,
      heading: (m[2] || '').trim(),
      text: section(body, 'TEXT') ?? '',
      ...(visual ? { visual } : {}),
      keywords,
      conceptIds: Array.from(new Set(conceptIds)),
      ...(unreadable ? { incomplete: true } : {}),
    });
  }

  slides.sort((a, b) => a.slideIndex - b.slideIndex);
  return {
    slides,
    complete: text.includes(END_OF_DOCUMENT),
    lastSlide: slides.length ? slides[slides.length - 1].slideIndex : null,
  };
}

/** Merges continuation results; the first complete copy of a slide wins. */
export function mergeSlides(existing: ParsedSlide[], incoming: ParsedSlide[]): ParsedSlide[] {
  const byIndex = new Map(existing.map((s) => [s.slideIndex, s]));
  for (const s of incoming) if (!byIndex.has(s.slideIndex)) byIndex.set(s.slideIndex, s);
  return Array.from(byIndex.values()).sort((a, b) => a.slideIndex - b.slideIndex);
}
