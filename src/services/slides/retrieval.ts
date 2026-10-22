/**
 * Lexical retrieval of slide excerpts for the course chat (runs on the client, because
 * guest courses only exist locally).
 *
 * Scoring is BM25-lite over heading/text/visual, plus boosts for curated bilingual
 * keywords, loose-key bigrams and linked concepts. A relevance gate decides which chunks
 * may be sent as evidence: if nothing passes, NO excerpts are returned — unrelated
 * slides are never presented as support for a claim.
 */
import type { Concept, SlideChunk, SlideSource } from '../../types';
import { bigrams, contentTokens, Token } from './normalize';

export type Grounding = 'slides' | 'no_match' | 'summaries_only' | 'partial';

export interface ChatExcerpt {
  source: string;
  slide: number;
  part: number;
  partCount: number;
  heading: string;
  text: string;
  visual?: string;
}

export interface ConceptSummary {
  name: string;
  summary: string;
  keyPrinciples: string[];
}

export interface RetrievalResult {
  grounding: Grounding;
  excerpts: ChatExcerpt[];
  /** Sources whose slide text is missing, failed, unsupported or only partial. */
  unavailableSources: string[];
  /** AI concept summaries, only when no slide text exists at all (grounding 'summaries_only'). */
  summaries: ConceptSummary[];
}

export interface RetrievalInput {
  /** Every source file the course should have slide text for. */
  expectedSources: Array<{ sourceId: string; fileName: string }>;
  slideSources: SlideSource[] | undefined;
  concepts: Concept[];
  message: string;
  /** The student's previous turns, most recent last (only the last two are used). */
  priorStudentTurns?: string[];
  focusConcept?: { id?: string; name: string; keyPrinciples?: string[] };
  maxExcerpts?: number;
  maxChars?: number;
}

const PRIMARY_WEIGHT = 1.0;
const LOOSE_WEIGHT = 0.6;
const KEYWORD_PRIMARY_BOOST = 1.5;
const KEYWORD_LOOSE_BOOST = 0.9;
const BIGRAM_BOOST = 2.0;
const QUERY_CONCEPT_BOOST = 1.5;
const FOCUS_CONCEPT_BOOST = 0.8;
// One distinctive term hit (~0.7) passes; hits on terms present in nearly every chunk (idf≈0) do not.
const MIN_SCORE = 0.6;
const MAX_SUMMARIES = 4;

interface QueryTerm {
  token: Token;
  weight: number;
}

interface IndexedChunk {
  chunk: SlideChunk;
  sourceId: string;
  fileName: string;
  primaryTf: Map<string, number>;
  looseTf: Map<string, number>;
  bigrams: Set<string>;
  kwPrimary: Set<string>;
  kwLoose: Set<string>;
  kwBigrams: Set<string>;
  length: number;
}

const countMap = (tokens: Token[], key: 'primary' | 'loose') => {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t[key], (m.get(t[key]) ?? 0) + 1);
  return m;
};

function indexChunk(chunk: SlideChunk, sourceId: string, fileName: string): IndexedChunk {
  const body = contentTokens(`${chunk.heading}\n${chunk.text}\n${chunk.visual ?? ''}`);
  const kwTokens = chunk.keywords.flatMap((k) => contentTokens(k));
  return {
    chunk,
    sourceId,
    fileName,
    primaryTf: countMap(body, 'primary'),
    looseTf: countMap(body, 'loose'),
    bigrams: new Set(bigrams(body)),
    kwPrimary: new Set(kwTokens.map((t) => t.primary)),
    kwLoose: new Set(kwTokens.map((t) => t.loose)),
    kwBigrams: new Set(chunk.keywords.flatMap((k) => bigrams(contentTokens(k)))),
    length: body.length,
  };
}

function buildQuery(input: RetrievalInput): { terms: QueryTerm[]; bigrams: Map<string, number> } {
  const byPrimary = new Map<string, QueryTerm>();
  const qBigrams = new Map<string, number>();
  const add = (text: string, weight: number) => {
    const tokens = contentTokens(text);
    for (const token of tokens) {
      const prev = byPrimary.get(token.primary);
      if (!prev || prev.weight < weight) byPrimary.set(token.primary, { token, weight });
    }
    for (const b of bigrams(tokens)) qBigrams.set(b, Math.max(qBigrams.get(b) ?? 0, weight));
  };
  add(input.message, 1);
  for (const turn of (input.priorStudentTurns ?? []).slice(-2)) add(turn, 0.5);
  return { terms: Array.from(byPrimary.values()), bigrams: qBigrams };
}

/** Concepts the query names explicitly (primary token or bigram hit on the concept name). */
function conceptsNamedByQuery(concepts: Concept[], terms: QueryTerm[], qBigrams: Map<string, number>): Set<string> {
  const primaries = new Set(terms.map((t) => t.token.primary));
  const ids = new Set<string>();
  for (const c of concepts) {
    const nameTokens = contentTokens(c.name);
    if (nameTokens.length === 0) continue;
    const allNamed = nameTokens.every((t) => primaries.has(t.primary));
    const bigramNamed = bigrams(nameTokens).some((b) => qBigrams.has(b));
    if (allNamed || bigramNamed) ids.add(c.id);
  }
  return ids;
}

const saturate = (tf: number) => tf / (tf + 1.2);

function scoreChunks(
  indexed: IndexedChunk[],
  terms: QueryTerm[],
  qBigrams: Map<string, number>,
  queryConceptIds: Set<string>,
  focusConceptId: string | undefined
): Array<{ item: IndexedChunk; score: number; qualifies: boolean }> {
  const n = indexed.length;
  const df = new Map<string, number>();
  for (const item of indexed) {
    const seen = new Set<string>([...item.looseTf.keys(), ...item.kwLoose]);
    for (const k of seen) df.set(k, (df.get(k) ?? 0) + 1);
  }
  const idf = (loose: string) => {
    const d = df.get(loose) ?? 0;
    return Math.log(1 + (n - d + 0.5) / (d + 0.5));
  };

  return indexed.map((item) => {
    let score = 0;
    let qualifies = false;

    for (const { token, weight } of terms) {
      const w = weight * idf(token.loose);
      const primaryTf = item.primaryTf.get(token.primary) ?? 0;
      if (primaryTf > 0) {
        score += w * PRIMARY_WEIGHT * saturate(primaryTf);
        qualifies = true;
      } else {
        const looseTf = item.looseTf.get(token.loose) ?? 0;
        if (looseTf > 0) score += w * LOOSE_WEIGHT * saturate(looseTf); // secondary: never qualifies alone
      }
      if (item.kwPrimary.has(token.primary)) {
        score += w * KEYWORD_PRIMARY_BOOST;
        qualifies = true;
      } else if (item.kwLoose.has(token.loose)) {
        score += w * KEYWORD_LOOSE_BOOST;
      }
    }

    for (const [b, weight] of qBigrams) {
      if (item.bigrams.has(b) || item.kwBigrams.has(b)) {
        score += weight * BIGRAM_BOOST;
        qualifies = true;
      }
    }

    const linked = item.chunk.conceptIds;
    if (linked.some((id) => queryConceptIds.has(id))) {
      score += QUERY_CONCEPT_BOOST;
      qualifies = true; // the student named this concept explicitly
    }
    if (focusConceptId && linked.includes(focusConceptId)) {
      score += FOCUS_CONCEPT_BOOST; // boost only — the focus concept alone is not evidence
    }

    return { item, score, qualifies: qualifies && score >= MIN_SCORE };
  });
}

const toExcerpt = (item: IndexedChunk): ChatExcerpt => ({
  source: item.fileName,
  slide: item.chunk.slideIndex,
  part: item.chunk.part,
  partCount: item.chunk.partCount,
  heading: item.chunk.heading,
  text: item.chunk.text,
  ...(item.chunk.visual ? { visual: item.chunk.visual } : {}),
});

const excerptChars = (item: IndexedChunk) => item.chunk.text.length + (item.chunk.visual?.length ?? 0);

function selectSummaries(
  concepts: Concept[],
  terms: QueryTerm[],
  focusConcept: RetrievalInput['focusConcept']
): ConceptSummary[] {
  const primaries = new Set(terms.map((t) => t.token.primary));
  const scored = concepts
    .map((c) => {
      const tokens = contentTokens(`${c.name} ${c.summary} ${(c.keyPrinciples ?? []).join(' ')}`);
      const hits = new Set(tokens.filter((t) => primaries.has(t.primary)).map((t) => t.primary)).size;
      const isFocus = !!focusConcept && (focusConcept.id === c.id || focusConcept.name === c.name);
      return { c, rank: hits + (isFocus ? 100 : 0) };
    })
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_SUMMARIES);
  return scored.map(({ c }) => ({ name: c.name, summary: c.summary, keyPrinciples: c.keyPrinciples ?? [] }));
}

/** Lists the sources a course should have slide text for: the primary material plus each chapter. */
export function expectedSourcesFor(course: {
  id: string;
  fileName: string;
  files?: Array<{ id: string; fileName: string }>;
}): Array<{ sourceId: string; fileName: string }> {
  return [
    { sourceId: course.id, fileName: course.fileName },
    ...(course.files ?? []).map((f) => ({ sourceId: f.id, fileName: f.fileName })),
  ];
}

export function retrieveExcerpts(input: RetrievalInput): RetrievalResult {
  const maxExcerpts = input.maxExcerpts ?? 6;
  const maxChars = input.maxChars ?? 6000;
  const sources = input.slideSources ?? [];
  const bySourceId = new Map(sources.map((s) => [s.sourceId, s]));

  const unavailableSources = input.expectedSources
    .filter((e) => {
      const s = bySourceId.get(e.sourceId);
      return !s || s.status !== 'ready';
    })
    .map((e) => e.fileName);

  const usable = sources.filter(
    (s) => (s.status === 'ready' || s.status === 'partial') && input.expectedSources.some((e) => e.sourceId === s.sourceId)
  );
  const indexed = usable.flatMap((s) => s.chunks.map((c) => indexChunk(c, s.sourceId, s.fileName)));

  const { terms, bigrams: qBigrams } = buildQuery(input);

  if (indexed.length === 0) {
    return {
      grounding: 'summaries_only',
      excerpts: [],
      unavailableSources,
      summaries: selectSummaries(input.concepts, terms, input.focusConcept),
    };
  }

  const queryConceptIds = conceptsNamedByQuery(input.concepts, terms, qBigrams);
  const focusId = input.focusConcept?.id;
  const ranked = scoreChunks(indexed, terms, qBigrams, queryConceptIds, focusId)
    .filter((r) => r.qualifies)
    .sort((a, b) => b.score - a.score);

  const chosen: IndexedChunk[] = [];
  const chosenIds = new Set<string>();
  let chars = 0;
  const tryAdd = (item: IndexedChunk) => {
    if (chosenIds.has(item.chunk.id) || chosen.length >= maxExcerpts) return false;
    const size = excerptChars(item);
    if (chars + size > maxChars && chosen.length > 0) return false;
    chosen.push(item);
    chosenIds.add(item.chunk.id);
    chars += size;
    return true;
  };

  for (const { item } of ranked) {
    if (chosen.length >= maxExcerpts) break;
    if (!tryAdd(item)) continue;
    // Siblings of a gated part, in reading order, while the budget allows.
    const siblings = indexed
      .filter((o) => o.sourceId === item.sourceId && o.chunk.slideIndex === item.chunk.slideIndex && o !== item)
      .sort((a, b) => a.chunk.part - b.chunk.part);
    for (const sib of siblings) tryAdd(sib);
  }

  if (chosen.length === 0) {
    return { grounding: 'no_match', excerpts: [], unavailableSources, summaries: [] };
  }

  // Present excerpts grouped by source/slide in reading order.
  chosen.sort(
    (a, b) =>
      a.fileName.localeCompare(b.fileName) || a.chunk.slideIndex - b.chunk.slideIndex || a.chunk.part - b.chunk.part
  );

  return {
    grounding: unavailableSources.length > 0 ? 'partial' : 'slides',
    excerpts: chosen.map(toExcerpt),
    unavailableSources,
    summaries: [],
  };
}
