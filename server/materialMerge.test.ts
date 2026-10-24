import { describe, expect, it } from 'vitest';

import { mergeChunkModules, normalizeKey, toRawModules } from './materialMerge';

describe('normalizeKey', () => {
  it('folds case, punctuation, diacritics and Arabic letter variants', () => {
    expect(normalizeKey('  Eigen-Values!! ')).toBe(normalizeKey('eigen values'));
    expect(normalizeKey('المُصفوفة')).toBe(normalizeKey('المصفوفه'));
    expect(normalizeKey('إحصاء')).toBe(normalizeKey('احصاء'));
    expect(normalizeKey(undefined)).toBe('');
  });
});

describe('mergeChunkModules', () => {
  it('merges a chapter split across a chunk boundary into one module in its original position', () => {
    const merged = mergeChunkModules([
      [
        { title: 'الفصل 1', concepts: [{ name: 'A' }] },
        { title: 'الفصل 2', concepts: [{ name: 'B' }] },
      ],
      [
        { title: 'الفصل 2', concepts: [{ name: 'C' }] },
        { title: 'الفصل 3', concepts: [{ name: 'D' }] },
      ],
    ]);

    expect(merged.map((m) => m.title)).toEqual(['الفصل 1', 'الفصل 2', 'الفصل 3']);
    expect(merged[1].concepts!.map((c) => c.name)).toEqual(['B', 'C']);
  });

  it('drops duplicate concepts and folds their key principles into the first occurrence', () => {
    const merged = mergeChunkModules([
      [{ title: 'Ch 1', concepts: [{ name: 'Matrix Rank', keyPrinciples: ['p1'] }] }],
      [{ title: 'Ch 2', concepts: [{ name: 'matrix  rank.', keyPrinciples: ['P1', 'p2'] }, { name: 'Determinant' }] }],
    ]);

    expect(merged[0].concepts).toEqual([{ name: 'Matrix Rank', keyPrinciples: ['p1', 'p2'] }]);
    expect(merged[1].concepts!.map((c) => c.name)).toEqual(['Determinant']);
  });

  it('removes modules that end up empty after deduplication', () => {
    const merged = mergeChunkModules([
      [{ title: 'Ch 1', concepts: [{ name: 'X' }] }],
      [{ title: 'Recap', concepts: [{ name: 'x' }] }],
    ]);

    expect(merged.map((m) => m.title)).toEqual(['Ch 1']);
  });

  it('never dedupes untitled modules or unnamed concepts against each other', () => {
    const merged = mergeChunkModules([
      [{ concepts: [{ coreFocus: 'a' }] }],
      [{ concepts: [{ coreFocus: 'b' }] }],
    ]);

    expect(merged).toHaveLength(2);
  });

  it('does not mutate the chunk results', () => {
    const input = [[{ title: 'Ch', concepts: [{ name: 'A', keyPrinciples: ['p1'] }] }], [{ title: 'Ch', concepts: [{ name: 'A', keyPrinciples: ['p2'] }] }]];
    mergeChunkModules(input);
    expect(input[0][0].concepts[0].keyPrinciples).toEqual(['p1']);
  });
});

describe('toRawModules', () => {
  it('discards malformed entries from model output', () => {
    expect(toRawModules('nope')).toEqual([]);
    expect(toRawModules([null, { title: 5, concepts: [null, { name: 'A', keyPrinciples: ['ok', 3, ' '] }] }])).toEqual([
      { title: undefined, concepts: [{ name: 'A', coreFocus: undefined, summary: undefined, keyPrinciples: ['ok'], difficulty: undefined }] },
    ]);
  });
});
