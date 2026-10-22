import { describe, expect, it } from 'vitest';

import type { Concept, CourseChatMessage, SavedCourse, SlideSource } from '../types';
import { buildSlideChunks } from './slides/chunking';
import {
  appendToThread,
  buildCourseChatRequest,
  conceptInCourse,
  extractVerdicts,
  isThreadFor,
  type ChatThreadState,
} from './chatSession';

const concept = (id: string, name: string, summary: string): Concept => ({
  id,
  name,
  summary,
  keyPrinciples: [],
  difficulty: 'basic',
});

const source = (sourceId: string, fileName: string, slides: Parameters<typeof buildSlideChunks>[1]): SlideSource => ({
  sourceId,
  fileName,
  status: 'ready',
  chunks: buildSlideChunks(sourceId, slides),
  slideCount: slides.length,
  incompleteSlides: [],
  extractedAt: 0,
});

const course = (id: string, fileName: string, concepts: Concept[], slideSources: SlideSource[]): SavedCourse => ({
  id,
  title: fileName.replace(/\.[^.]+$/, ''),
  fileName,
  fileSize: 1,
  fileType: 'pdf',
  concepts,
  material: { fileName, fileSize: 1, fileType: 'pdf' },
  createdAt: 0,
  updatedAt: 0,
  masteredConceptIds: [],
  slideSources,
});

// Course A: networking. Course B: a different subject that ALSO uses the term "access point".
const apA = concept('a-ap', 'Access Point', 'نقطة الوصول تربط الأجهزة اللاسلكية بالشبكة السلكية');
const courseA = course('course-A', 'networks.pdf', [apA], [
  source('course-A', 'networks.pdf', [
    {
      slideIndex: 3,
      heading: 'Access Point (AP)',
      text: 'An access point connects wireless clients to a wired LAN at Layer 2. It does not route between IP networks.',
      keywords: ['access point', 'نقطة الوصول'],
      conceptIds: ['a-ap'],
    },
    {
      slideIndex: 4,
      heading: 'Router',
      text: 'A router forwards packets between different networks at Layer 3.',
      keywords: ['router', 'الموجه'],
      conceptIds: [],
    },
  ]),
]);

const apB = concept('b-ap', 'Access point (vascular)', 'نقطة الوصول الوعائي في القسطرة');
const courseBSource = source('course-B', 'cardiology.pdf', [
  {
    slideIndex: 9,
    heading: 'Vascular access point',
    text: 'The femoral access point is used for catheterization. Secret detail only in course B.',
    keywords: ['access point', 'نقطة الوصول', 'catheter'],
    conceptIds: ['b-ap'],
  },
]);
const courseB = course('course-B', 'cardiology.pdf', [apB], [courseBSource]);

const msg = (role: 'student' | 'duck', text: string): CourseChatMessage => ({
  id: `${role}-${text.length}-${Math.random()}`,
  role,
  text,
  createdAt: 0,
});

const threadA: ChatThreadState = {
  courseId: 'course-A',
  messages: [msg('student', 'شو هو الـ Access Point؟'), msg('duck', '✅ يربط الأجهزة اللاسلكية بالشبكة السلكية')],
};

const allText = (req: ReturnType<typeof buildCourseChatRequest>) => JSON.stringify(req);

describe('course isolation — retrieval', () => {
  it('a request for course A never contains chunks of course B', () => {
    const req = buildCourseChatRequest({ course: courseA, thread: threadA, message: 'ما وظيفة نقطة الوصول؟', concept: null });
    expect(req.courseId).toBe('course-A');
    expect(req.excerpts.length).toBeGreaterThan(0);
    expect(req.excerpts.every((e) => e.source === 'networks.pdf')).toBe(true);
    expect(allText(req)).not.toContain('Secret detail only in course B');
  });

  it('identical keywords do not pull in another course\'s source, even if it was mis-stored on course A', () => {
    const contaminated: SavedCourse = { ...courseA, slideSources: [...courseA.slideSources!, courseBSource] };
    const req = buildCourseChatRequest({ course: contaminated, thread: threadA, message: 'access point catheter نقطة الوصول', concept: null });
    expect(req.excerpts.every((e) => e.source === 'networks.pdf')).toBe(true);
    expect(allText(req)).not.toContain('cardiology.pdf');
    expect(allText(req)).not.toContain('Secret detail only in course B');
  });

  it('drops chunks whose id belongs to another source', () => {
    const [chunkB] = courseBSource.chunks;
    const injected: SavedCourse = {
      ...courseA,
      slideSources: [{ ...courseA.slideSources![0], chunks: [...courseA.slideSources![0].chunks, chunkB] }],
    };
    const req = buildCourseChatRequest({ course: injected, thread: threadA, message: 'catheter femoral access point', concept: null });
    expect(allText(req)).not.toContain('Secret detail only in course B');
  });
});

describe('course isolation — switching courses', () => {
  it('a request for course B never carries course A history', () => {
    const req = buildCourseChatRequest({ course: courseB, thread: threadA, message: 'وش هي نقطة الوصول؟', concept: null });
    expect(req.history).toEqual([]);
    expect(allText(req)).not.toContain('يربط الأجهزة اللاسلكية');
  });

  it('sends no history while the new course thread is still loading', () => {
    const loading: ChatThreadState = { courseId: null, messages: threadA.messages };
    expect(isThreadFor(loading, 'course-A')).toBe(false);
    const req = buildCourseChatRequest({ course: courseA, thread: loading, message: 'x', concept: null });
    expect(req.history).toEqual([]);
  });

  it('drops a focus concept that belongs to another course', () => {
    expect(conceptInCourse(courseB, apA)).toBeNull();
    const req = buildCourseChatRequest({ course: courseB, thread: { courseId: 'course-B', messages: [] }, message: 'اشرح', concept: apA });
    expect(req.focusConcept).toBeUndefined();
    expect(allText(req)).not.toContain(apA.summary);
  });

  it('keeps a focus concept from the same course', () => {
    const req = buildCourseChatRequest({ course: courseA, thread: threadA, message: 'اشرح', concept: apA });
    expect(req.focusConcept?.name).toBe('Access Point');
  });
});

describe('course isolation — stale asynchronous replies', () => {
  it('a late reply for course A is not appended to course B', () => {
    const threadB: ChatThreadState = { courseId: 'course-B', messages: [] };
    const late = msg('duck', 'reply meant for course A');
    expect(appendToThread(threadB, 'course-A', late)).toBe(threadB);
    expect(appendToThread(threadB, 'course-B', late).messages).toEqual([late]);
  });

  it('a late reply is not appended while the thread is reloading', () => {
    const loading: ChatThreadState = { courseId: null, messages: [] };
    expect(appendToThread(loading, 'course-A', msg('duck', 'late')).messages).toEqual([]);
  });
});

describe('follow-up context within the same course', () => {
  it('sends earlier turns of the same course (not the current message) and uses them for retrieval', () => {
    const followUp = 'طيب ليش ما يعتبر راوتر؟';
    const req = buildCourseChatRequest({ course: courseA, thread: threadA, message: followUp, concept: null });
    expect(req.history.map((h) => h.text)).toEqual(threadA.messages.map((m) => m.text));
    expect(req.history.some((h) => h.text === followUp)).toBe(false);
    // The earlier student turn ("Access Point") keeps the AP slide in scope for the follow-up.
    expect(req.excerpts.map((e) => e.slide)).toContain(3);
  });

  it('caps history at the last 6 turns', () => {
    const long: ChatThreadState = { courseId: 'course-A', messages: Array.from({ length: 10 }, (_, i) => msg('student', `m${i}`)) };
    const req = buildCourseChatRequest({ course: courseA, thread: long, message: 'x', concept: null });
    expect(req.history.map((h) => h.text)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9']);
  });
});

describe('extractVerdicts — visible verdict in the chat UI', () => {
  it('reads an explicit positive verdict', () => {
    expect(extractVerdicts('✅ 📑 (networks.pdf، شريحة 3): صحيح، نقطة الوصول توفر اتصالاً لاسلكياً بالشبكة.')).toEqual(['correct']);
  });

  it('reads a correction', () => {
    expect(extractVerdicts('❌ 🌐: نقطة الوصول عادةً لا توزّع عناوين IP؛ هذا دور DHCP.')).toEqual(['incorrect']);
  });

  it('distinguishes partially correct from incorrect, in order of appearance', () => {
    const reply = '⚠️ صحيح جزئياً: ...\n❌ خطأ: ...\n- ✅ صحيح: ...';
    expect(extractVerdicts(reply)).toEqual(['partial', 'incorrect', 'correct']);
  });

  it('reads the "unclear / insufficient evidence" verdict', () => {
    expect(extractVerdicts('❓ وش تقصد بـ"يربط"؟ وضّح لي أكثر.')).toEqual(['unclear']);
  });

  it('shows no verdict for a reply without claim lines (greeting, plain answer)', () => {
    expect(extractVerdicts('هلا! اسألني عن أي مفهوم في المادة.')).toEqual([]);
    expect(extractVerdicts('الفكرة هنا ✅ واضحة في منتصف الجملة')).toEqual([]);
  });
});
