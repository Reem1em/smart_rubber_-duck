/**
 * Server-renders the merged question flow with a stubbed app state: the screen every
 * question entry point lands on must offer a working upload field (Defects B/C).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedCourse, SlideSource } from '../types';

const state: Record<string, unknown> = {};
vi.mock('../context/AppStateContext', () => ({ useAppState: () => state }));

import { canonicalStep, QUESTIONS_NAV, QUESTIONS_STEP } from '../navigation';
import { GenerateQuestionsPanel } from './GenerateQuestionsPanel';

const readySource: SlideSource = {
  sourceId: 'course-1',
  fileName: 'lectures.pdf',
  status: 'ready',
  chunks: [{ id: 'c1', sourceId: 'course-1', fileName: 'lectures.pdf', slideIndex: 1, part: 1, partCount: 1, heading: 'TCP', text: 'TCP بروتوكول نقل موثوق.' } as any],
  slideCount: 1,
  incompleteSlides: [],
  extractedAt: 1,
};

const course = (slideSources: SlideSource[] = [readySource]): SavedCourse =>
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
    slideSources,
  }) as SavedCourse;

function render(c: SavedCourse, extracting: string[] = []): string {
  Object.assign(state, {
    courses: [c],
    selectedCourseId: c.id,
    setSelectedCourseId: vi.fn(),
    performance: {},
    addAttempt: vi.fn(),
    setStep: vi.fn(),
    showRateLimitModal: vi.fn(),
    saveExamToCourse: vi.fn(),
    extractingSlideSourceIds: extracting,
    openCourseChat: vi.fn(),
  });
  return renderToStaticMarkup(createElement(GenerateQuestionsPanel));
}

beforeEach(() => {
  for (const k of Object.keys(state)) delete state[k];
});

describe('navigation (Defect C)', () => {
  it('both former entry points resolve to the single question flow', () => {
    expect(canonicalStep('practice')).toBe(QUESTIONS_STEP);
    expect(canonicalStep('generateQuestions')).toBe(QUESTIONS_STEP);
    expect(canonicalStep('courses')).toBe('courses');
    expect(QUESTIONS_NAV.label).toBe('ولّد أسئلة');
  });
});

describe('question flow screen (Defect B)', () => {
  it('has a working exam upload field accepting the supported types', () => {
    const html = render(course());
    expect(html).toMatch(/<input[^>]*type="file"[^>]*data-testid="exam-upload-input"|<input[^>]*data-testid="exam-upload-input"[^>]*type="file"/);
    expect(html).toContain('accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"');
    expect(html).toContain('رفع نموذج الاختبار');
  });

  it('offers course-files-only generation when the course has extracted text', () => {
    const html = render(course());
    expect(html).toContain('المتابعة بدون نموذج');
    expect(html).not.toContain('غير متاح:');
  });

  it('explains why course-only generation is unavailable instead of a bare "no text"', () => {
    expect(render(course([]), ['course-1'])).toContain('جاري استخراج نص ملفات المقرر الآن');
    const failed = { ...readySource, status: 'failed' as const, chunks: [], error: 'تمت قراءة الملف كاملاً ولم يُعثر فيه على نص' };
    const html = render(course([failed]));
    expect(html).toContain('تعذر استخراج نص ملفات المقرر');
    expect(html).toContain('lectures.pdf');
  });

  it('never shows fabricated exam weights before an exam is analyzed', () => {
    const html = render(course());
    expect(html).not.toContain('وزن النموذج');
    expect(html).not.toContain('سؤال من النموذج المرفوع');
  });
});
