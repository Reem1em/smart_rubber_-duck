import { describe, expect, it } from 'vitest';

import type { SavedCourse, SlideSource } from '../types';
import { listPracticeDocuments, resolvePracticeDocuments } from './practiceTest';

function source(sourceId: string, fileName: string, text: string, status: SlideSource['status'] = 'ready'): SlideSource {
  return {
    sourceId,
    fileName,
    status,
    slideCount: 1,
    incompleteSlides: [],
    extractedAt: 0,
    chunks: [
      { id: `${sourceId}#s1p1`, slideIndex: 1, part: 1, partCount: 1, heading: 'Subnetting', text, keywords: [], conceptIds: [] },
    ],
  };
}

function course(overrides: Partial<SavedCourse> = {}): SavedCourse {
  return {
    id: 'course1',
    title: 'Networks',
    fileName: 'Syllabus.pdf',
    fileSize: 1000,
    fileType: 'application/pdf',
    concepts: [],
    material: { fileName: 'Syllabus.pdf', fileSize: 1000, fileType: 'application/pdf' },
    createdAt: 1_000,
    updatedAt: 1_000,
    masteredConceptIds: [],
    files: [
      { id: 'f1', fileName: 'Midterm_2025.pdf', fileSize: 2048, fileType: 'application/pdf', uploadedAt: 3_000, conceptsCount: 2, status: 'ready' },
      { id: 'f2', fileName: 'Quiz1.pdf', fileSize: 512, fileType: 'application/pdf', uploadedAt: 2_000, conceptsCount: 1, status: 'ready' },
    ],
    slideSources: [
      source('course1', 'Syllabus.pdf', 'Course outline'),
      source('f1', 'Midterm_2025.pdf', '192.168.1.0/24 has 254 hosts', 'partial'),
      source('f2', 'Quiz1.pdf', 'broken', 'failed'),
    ],
    ...overrides,
  };
}

describe('listPracticeDocuments', () => {
  it('lists readable sources newest first with file metadata', () => {
    const docs = listPracticeDocuments(course());
    expect(docs.map((d) => d.id)).toEqual(['f1', 'course1']);
    expect(docs[0]).toMatchObject({ name: 'Midterm_2025.pdf', fileSize: 2048, uploadedAt: 3_000, partial: true });
  });

  it('falls back to pasted raw text when the course has no slide sources', () => {
    const c = course({ slideSources: undefined, files: [], material: { fileName: 'نص', fileSize: 10, fileType: 'text/plain', rawText: '  Ohm law V = IR  ' } });
    expect(listPracticeDocuments(c)).toEqual([
      expect.objectContaining({ id: 'course1', textLength: 'Ohm law V = IR'.length }),
    ]);
    expect(resolvePracticeDocuments(c, ['course1'])[0].text).toBe('Ohm law V = IR');
  });
});

describe('resolvePracticeDocuments', () => {
  it('resolves ids to text with ISO dates and skips unknown or unreadable ids', () => {
    const docs = resolvePracticeDocuments(course(), ['f1', 'f2', 'nope', 'f1']);
    expect(docs).toEqual([
      { name: 'Midterm_2025.pdf', text: 'Subnetting\n192.168.1.0/24 has 254 hosts', date: new Date(3_000).toISOString() },
    ]);
  });
});
