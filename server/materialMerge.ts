/**
 * Reduce phase of chunked material analysis: folds the per-chunk module lists returned
 * by the model into one ordered course structure without duplicate modules or concepts.
 */

export interface RawConcept {
  name?: string;
  coreFocus?: string;
  summary?: string;
  keyPrinciples?: string[];
  difficulty?: string;
}

export interface RawModule {
  title?: string;
  concepts?: RawConcept[];
}

const MAX_KEY_PRINCIPLES = 5;

/**
 * Comparison key for titles and concept names: case-, diacritic- and punctuation-insensitive,
 * with common Arabic letter variants folded together (أ/إ/آ → ا, ى → ي, ة → ه).
 */
export function normalizeKey(value: string | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Coerces whatever the model returned for `modules` into typed modules. */
export function toRawModules(value: unknown): RawModule[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => ({
      title: typeof m.title === 'string' ? m.title : undefined,
      concepts: Array.isArray(m.concepts)
        ? m.concepts
            .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
            .map((c) => ({
              name: typeof c.name === 'string' ? c.name : undefined,
              coreFocus: typeof c.coreFocus === 'string' ? c.coreFocus : undefined,
              summary: typeof c.summary === 'string' ? c.summary : undefined,
              keyPrinciples: Array.isArray(c.keyPrinciples)
                ? c.keyPrinciples.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
                : undefined,
              difficulty: typeof c.difficulty === 'string' ? c.difficulty : undefined,
            }))
        : [],
    }));
}

function mergeKeyPrinciples(target: RawConcept, extra: string[] | undefined): void {
  if (!extra || extra.length === 0) return;
  const merged = [...(target.keyPrinciples ?? [])];
  const seen = new Set(merged.map(normalizeKey));
  for (const principle of extra) {
    const key = normalizeKey(principle);
    if (!key || seen.has(key) || merged.length >= MAX_KEY_PRINCIPLES) continue;
    seen.add(key);
    merged.push(principle);
  }
  target.keyPrinciples = merged;
}

/**
 * Merges chunk results in document order.
 *
 * - Modules with the same normalized title (e.g. a chapter split across a chunk boundary)
 *   collapse into the first occurrence, keeping that position in the sequence.
 * - A concept whose normalized name was already seen anywhere in the course is dropped;
 *   its extra key principles are folded into the surviving entry.
 * - Modules left without concepts are removed, so the caller can number what remains 1..n.
 */
export function mergeChunkModules(chunkResults: RawModule[][]): RawModule[] {
  const modules: RawModule[] = [];
  const moduleByKey = new Map<string, RawModule>();
  const conceptByKey = new Map<string, RawConcept>();

  for (const chunkModules of chunkResults) {
    for (const mod of chunkModules) {
      const titleKey = normalizeKey(mod.title);
      let target = titleKey ? moduleByKey.get(titleKey) : undefined;
      if (!target) {
        target = { title: mod.title, concepts: [] };
        modules.push(target);
        if (titleKey) moduleByKey.set(titleKey, target);
      }

      for (const concept of mod.concepts ?? []) {
        const conceptKey = normalizeKey(concept.name);
        const existing = conceptKey ? conceptByKey.get(conceptKey) : undefined;
        if (existing) {
          mergeKeyPrinciples(existing, concept.keyPrinciples);
          continue;
        }
        const copy: RawConcept = { ...concept, keyPrinciples: concept.keyPrinciples ? [...concept.keyPrinciples] : undefined };
        target.concepts!.push(copy);
        if (conceptKey) conceptByKey.set(conceptKey, copy);
      }
    }
  }

  return modules.filter((m) => (m.concepts?.length ?? 0) > 0);
}
