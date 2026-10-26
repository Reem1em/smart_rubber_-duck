import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ai/extractSlides', () => ({ extractSlides: vi.fn() }));
vi.mock('../../utils/fetchWithTimeout', () => ({ fetchWithTimeout: vi.fn() }));

import type { CourseFile, SavedCourse, SlideSource } from '../../types';
import { extractSlides } from '../ai/extractSlides';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  GenerateQuestionsError,
  courseDocuments,
  generateQuestions,
  isParsedExamFile,
  readExamFile,
  verifiedProvenance,
} from './generateQuestions';

const mockExtract = vi.mocked(extractSlides);
const mockFetch = vi.mocked(fetchWithTimeout);

const ARABIC_EXAM = 'السؤال الأول: ما وظيفة بروتوكول TCP في طبقة النقل؟\nالسؤال الثاني: احسب عنوان الشبكة للعنوان 192.168.1.10/24.';

const source = (sourceId: string, status: SlideSource['status'], text = ARABIC_EXAM, error?: string): SlideSource => ({
  sourceId,
  fileName: `${sourceId}.pdf`,
  status,
  chunks: status === 'ready' || status === 'partial' ? [{ id: `${sourceId}-1`, sourceId, fileName: `${sourceId}.pdf`, slideIndex: 1, part: 1, partCount: 1, heading: '', text } as any] : [],
  slideCount: 1,
  incompleteSlides: [],
  extractedAt: 0,
  ...(error ? { error } : {}),
});

const file = (id: string, kind?: CourseFile['kind']): CourseFile => ({
  id,
  fileName: `${id}.pdf`,
  fileSize: 10,
  fileType: 'application/pdf',
  uploadedAt: 1,
  conceptsCount: 0,
  status: 'ready',
  ...(kind ? { kind } : {}),
});

const course = (over: Partial<SavedCourse> = {}): SavedCourse =>
  ({
    id: 'course-1',
    title: 'شبكات الحاسب',
    fileName: 'lectures.pdf',
    fileSize: 1,
    createdAt: 1,
    updatedAt: 1,
    material: { fileName: 'lectures.pdf', fileSize: 1, fileType: 'pdf' },
    concepts: [{ id: 'tcp', name: 'TCP', summary: 'نقل موثوق', keyPrinciples: [], difficulty: 'basic' }],
    files: [],
    slideSources: [],
    ...over,
  }) as SavedCourse;

beforeEach(() => {
  mockExtract.mockReset();
  mockFetch.mockReset();
});

describe('readExamFile (Defect A)', () => {
  it('extracts an Arabic text file and proceeds with its text and a real file id', async () => {
    mockExtract.mockImplementation(async (_m, sourceId) => source(sourceId, 'ready'));
    const exam = await readExamFile(new File([ARABIC_EXAM], 'نموذج.txt', { type: 'text/plain' }), []);
    expect(exam.text).toContain('بروتوكول TCP');
    expect(exam.fileId).toMatch(/^[0-9a-f]{64}$/);
    expect(mockExtract.mock.calls[0][0]).toMatchObject({ rawText: ARABIC_EXAM });
  });

  it('turns an extraction that found no text into an error saying what was tried', async () => {
    mockExtract.mockImplementation(async (_m, sourceId) =>
      source(sourceId, 'failed', '', 'تمت قراءة الملف كاملاً ولم يُعثر فيه على نص قابل للقراءة.')
    );
    const err = await readExamFile(new File([new Uint8Array([1, 2, 3])], 'scan.pdf', { type: 'application/pdf' }), []).catch((e) => e);
    expect(err).toBeInstanceOf(GenerateQuestionsError);
    expect(err.kind).toBe('unreadable');
    expect(err.message).toContain('PDF');
    expect(err.message).toContain('scan.pdf');
    expect(err.message).toContain('لم يُعثر فيه على نص');
  });

  it('rejects an empty file without calling the server', async () => {
    const err = await readExamFile(new File([], 'empty.pdf', { type: 'application/pdf' }), []).catch((e) => e);
    expect(err.kind).toBe('unreadable');
    expect(err.message).toMatch(/فارغ/);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('rejects a wrong file type with a clear message, without calling the server', async () => {
    const err = await readExamFile(new File(['x'], 'slides.pptx'), []).catch((e) => e);
    expect(err.kind).toBe('unreadable');
    expect(err.message).toMatch(/pptx/);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('surfaces a transport failure as an error instead of hanging', async () => {
    mockExtract.mockRejectedValue(new Error('انتهت مهلة انتظار الاستجابة. يرجى المحاولة مرة أخرى.'));
    const err = await readExamFile(new File([ARABIC_EXAM], 'a.txt'), []).catch((e) => e);
    expect(err).toBeInstanceOf(GenerateQuestionsError);
    expect(err.message).toContain('انتهت مهلة');
  });
});

describe('provenance (Defect D)', () => {
  const exam = { source: 'uploaded_exam' as const, sourceFileId: 'exam-1' };

  it('no file uploaded → no uploaded-exam label', () => {
    expect(verifiedProvenance(exam, course())).toBe('generated');
    expect(verifiedProvenance({ source: 'uploaded_exam' }, course())).toBe('generated');
  });

  it('file uploaded but parsing failed → no uploaded-exam label', () => {
    const c = course({ files: [file('exam-1', 'exam')], slideSources: [source('exam-1', 'failed', '', 'تالف')] });
    expect(isParsedExamFile(c, 'exam-1')).toBe(false);
    expect(verifiedProvenance(exam, c)).toBe('generated');
  });

  it('a stored course file that is not an exam model → no uploaded-exam label', () => {
    const c = course({ files: [file('exam-1', 'material')], slideSources: [source('exam-1', 'ready')] });
    expect(verifiedProvenance(exam, c)).toBe('generated');
  });

  it('stored, parsed exam file → label kept (including mixed)', () => {
    const c = course({ files: [file('exam-1', 'exam')], slideSources: [source('exam-1', 'ready')] });
    expect(verifiedProvenance(exam, c)).toBe('uploaded_exam');
    expect(verifiedProvenance({ source: 'mixed', sourceFileId: 'exam-1' }, c)).toBe('mixed');
    expect(verifiedProvenance({ source: 'uploaded_exam', sourceFileId: 'other' }, c)).toBe('generated');
  });

  it('only sends the exam fileId to the server when the exam is stored and parsed', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ questions: [{}], coverage: [], requestedTotal: 1 }) } as Response);
    const examText = { fileId: 'exam-1', name: 'e', size: 1, mimeType: 'text/plain', text: ARABIC_EXAM, source: source('exam-1', 'ready') };
    const topics = [{ concept: course().concepts[0], count: 1, difficulty: 100 as const }];

    await generateQuestions({ course: course(), exam: examText, difficulty: 100, topics });
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]!.body)).exam.fileId).toBeUndefined();

    const stored = course({ files: [file('exam-1', 'exam')], slideSources: [source('exam-1', 'ready')] });
    await generateQuestions({ course: stored, exam: examText, difficulty: 100, topics });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1]!.body)).exam.fileId).toBe('exam-1');
  });
});

describe('courseDocuments', () => {
  it('excludes stored exam models from the course material', () => {
    const c = course({
      files: [file('ch-1', 'material'), file('exam-1', 'exam')],
      slideSources: [source('ch-1', 'ready', 'محاضرة عن طبقة النقل وبروتوكول TCP'), source('exam-1', 'ready')],
    });
    expect(courseDocuments(c).map((d) => d.name)).toEqual(['ch-1.pdf']);
  });
});
