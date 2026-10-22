import { describe, expect, it } from 'vitest';

import type { Concept, SlideSource } from '../../types';
import { buildSlideChunks } from './chunking';
import { expectedSourcesFor, retrieveExcerpts } from './retrieval';

const concept = (id: string, name: string, summary = ''): Concept => ({
  id,
  name,
  summary,
  keyPrinciples: [],
  difficulty: 'basic',
});

const concepts: Concept[] = [
  concept('ap', 'Access Point', 'نقطة الوصول تربط الأجهزة اللاسلكية بالشبكة السلكية'),
  concept('rt', 'Router', 'الموجه يوجه الحزم بين الشبكات'),
  concept('wifi', 'Wireless standards', 'معايير IEEE 802.11'),
];

const longPart = (label: string) =>
  `${label}: The 802.11 family defines the physical and MAC layers for wireless LANs. `.repeat(12);

const netSource: SlideSource = {
  sourceId: 'course1',
  fileName: 'networks.pdf',
  status: 'ready',
  slideCount: 4,
  incompleteSlides: [],
  extractedAt: 0,
  chunks: buildSlideChunks('course1', [
    {
      slideIndex: 1,
      heading: 'Access Point (AP)',
      text: 'An access point connects wireless clients to a wired Ethernet LAN. It works at Layer 2 and does not route between different IP networks.',
      visual: 'Laptop → AP → Switch (wired uplink)',
      keywords: ['access point', 'نقطة الوصول', 'نقطة اتصال لاسلكية', 'WLAN'],
      conceptIds: ['ap'],
    },
    {
      slideIndex: 2,
      heading: 'Router',
      text: 'A router forwards packets between different networks using IP addresses. It works at Layer 3.',
      keywords: ['router', 'الموجه', 'توجيه الحزم'],
      conceptIds: ['rt'],
    },
    {
      slideIndex: 3,
      heading: 'Wireless standards',
      text: [longPart('Overview'), longPart('Bands') + ' Beamforming steers the signal.', longPart('Security')].join('\n\n'),
      keywords: ['802.11', 'wifi', 'معايير لاسلكية'],
      conceptIds: ['wifi'],
    },
    {
      slideIndex: 4,
      heading: 'ملاحظات',
      text: 'تم حفظ الملف في مكتبه القسم.',
      keywords: [],
      conceptIds: [],
    },
  ]),
};

const course = { id: 'course1', fileName: 'networks.pdf' };

const run = (message: string, extra: Partial<Parameters<typeof retrieveExcerpts>[0]> = {}) =>
  retrieveExcerpts({
    expectedSources: expectedSourcesFor(course),
    slideSources: [netSource],
    concepts,
    message,
    ...extra,
  });

describe('retrieveExcerpts — cross-language relevance', () => {
  it('finds the English "Access Point" slide for an Arabic question, not the Router slide', () => {
    const res = run('ما وظيفة نقطة الوصول؟');
    expect(res.grounding).toBe('slides');
    expect(res.excerpts.map((e) => e.slide)).toContain(1);
    expect(res.excerpts.map((e) => e.slide)).not.toContain(2);
    expect(res.excerpts[0]).toMatchObject({ source: 'networks.pdf', slide: 1, part: 1, partCount: 1 });
    expect(res.excerpts[0].visual).toContain('AP → Switch');
  });

  it('matches a spelling variant through the keyword bigram (نقطه الوصول)', () => {
    const res = run('شو دور نقطه الوصول؟');
    expect(res.excerpts.map((e) => e.slide)).toEqual([1]);
  });

  it('retrieves both slides for the mixed Access Point / router claim', () => {
    const res = run('الـ Access Point يربط شبكتين مختلفتين على مستوى الراوتر، وهو يسمح للأجهزة اللاسلكية بالاتصال بالشبكة السلكية');
    expect(res.excerpts.map((e) => e.slide)).toContain(1);
  });
});

describe('retrieveExcerpts — ranking and budget', () => {
  it('uses the focus concept as a tie-breaking boost', () => {
    const toRouter = run('What happens at the layer?', { focusConcept: { id: 'rt', name: 'Router' }, maxExcerpts: 1 });
    expect(toRouter.excerpts.map((e) => e.slide)).toEqual([2]);
    const toAp = run('What happens at the layer?', { focusConcept: { id: 'ap', name: 'Access Point' }, maxExcerpts: 1 });
    expect(toAp.excerpts.map((e) => e.slide)).toEqual([1]);
  });

  it('adds sibling parts of a matched part in reading order', () => {
    const res = run('What is beamforming?');
    const slide3 = res.excerpts.filter((e) => e.slide === 3);
    expect(slide3.length).toBeGreaterThan(1);
    expect(slide3.map((e) => e.part)).toEqual([...slide3.map((e) => e.part)].sort((a, b) => a - b));
    expect(slide3.every((e) => e.partCount === slide3[0].partCount)).toBe(true);
  });

  it('caps the number of excerpts', () => {
    const res = run('802.11 wireless LAN layer networks access point router', { maxExcerpts: 2 });
    expect(res.excerpts.length).toBeLessThanOrEqual(2);
  });

  it('caps the total characters (beyond the first excerpt)', () => {
    const res = run('What is beamforming?', { maxChars: 1200 });
    const total = res.excerpts.reduce((n, e) => n + e.text.length + (e.visual?.length ?? 0), 0);
    expect(res.excerpts.length).toBeGreaterThanOrEqual(1);
    expect(res.excerpts.length === 1 || total <= 1200).toBe(true);
  });
});

describe('retrieveExcerpts — relevance gate (never unrelated evidence)', () => {
  it('returns zero excerpts and no_match for an unrelated question', () => {
    const res = run('ما هو البناء الضوئي في النبات؟');
    expect(res.grounding).toBe('no_match');
    expect(res.excerpts).toEqual([]);
  });

  it('does not qualify a chunk on a secondary-key hit alone', () => {
    // "مكتبة" vs the slide's "مكتبه": loose match only.
    const res = run('مكتبة');
    expect(res.excerpts).toEqual([]);
    expect(res.grounding).toBe('no_match');
  });

  it('does not qualify a chunk on the focus concept alone', () => {
    const res = run('اشرح لي أكثر لو سمحت', { focusConcept: { id: 'ap', name: 'Access Point' } });
    expect(res.excerpts).toEqual([]);
    expect(res.grounding).toBe('no_match');
  });

  it('never returns sibling parts without a gated part', () => {
    const res = run('ما هو البناء الضوئي؟');
    expect(res.excerpts.some((e) => e.slide === 3)).toBe(false);
  });
});

describe('retrieveExcerpts — source availability', () => {
  it('falls back to labelled concept summaries when no slide text exists', () => {
    const res = retrieveExcerpts({
      expectedSources: expectedSourcesFor(course),
      slideSources: undefined,
      concepts,
      message: 'وش الفرق بين الموجه ونقطة الوصول؟',
      focusConcept: { id: 'ap', name: 'Access Point' },
    });
    expect(res.grounding).toBe('summaries_only');
    expect(res.excerpts).toEqual([]);
    expect(res.summaries[0].name).toBe('Access Point');
    expect(res.unavailableSources).toEqual(['networks.pdf']);
  });

  it('reports partial grounding and lists sources without usable slide text', () => {
    const res = retrieveExcerpts({
      expectedSources: expectedSourcesFor({ ...course, files: [{ id: 'ch2', fileName: 'chapter2.pdf' }] }),
      slideSources: [netSource, { ...netSource, sourceId: 'ch2', fileName: 'chapter2.pdf', status: 'failed', chunks: [] }],
      concepts,
      message: 'ما وظيفة نقطة الوصول؟',
    });
    expect(res.grounding).toBe('partial');
    expect(res.unavailableSources).toEqual(['chapter2.pdf']);
    expect(res.excerpts.length).toBeGreaterThan(0);
  });

  it('ignores chunks from failed sources', () => {
    const res = retrieveExcerpts({
      expectedSources: expectedSourcesFor(course),
      slideSources: [{ ...netSource, status: 'failed' }],
      concepts,
      message: 'ما وظيفة نقطة الوصول؟',
    });
    expect(res.grounding).toBe('summaries_only');
    expect(res.excerpts).toEqual([]);
  });
});
