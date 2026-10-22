/**
 * Route-level tests for the course chat with the model mocked: no API tokens are used.
 * Covers the claim-evaluation pass-through, the deterministic citation guard, and that
 * each message costs exactly one model call.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../gemini', () => ({
  generateInteractive: vi.fn(),
  isQuotaOrRateLimitError: () => false,
  isServerOverloadError: () => false,
}));
vi.mock('../auth/session', () => ({
  bearerToken: () => null,
  verifySession: () => null,
}));
vi.mock('../auth/courseStore', () => ({
  getUserCourse: vi.fn(async () => undefined),
}));

import { generateInteractive } from '../gemini';
import { handleCourseChat } from './courseChat';

const mockModel = vi.mocked(generateInteractive);

const excerpt = {
  source: 'networks.pdf',
  slide: 3,
  part: 1,
  partCount: 1,
  heading: 'Access Point (AP)',
  text: 'An access point provides wireless clients access to a wired LAN. DHCP is usually provided by a router or server.',
};

function call(body: any) {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (b: any) => {
    res.body = b;
    return res;
  };
  return handleCourseChat({ params: { id: 'course-A' }, headers: {}, body } as any, res).then(() => res);
}

const slidesBody = (message: string) => ({
  courseTitle: 'Computer Networks',
  conceptNames: ['Access Point'],
  message,
  history: [],
  excerpts: [excerpt],
  grounding: 'slides',
  unavailableSources: [],
  summaries: [],
});

beforeEach(() => mockModel.mockReset());

describe('course chat — claim evaluation (mocked model)', () => {
  it('passes an explicit positive verdict through with its valid slide citation, in one model call', async () => {
    const reply = '✅ 📑 (networks.pdf، شريحة 3): صحيح، نقطة الوصول توفر اتصالاً لاسلكياً بالشبكة.';
    mockModel.mockResolvedValueOnce({ text: reply });
    const res = await call(slidesBody('الـ access point يوفر اتصال لاسلكي بالشبكة'));
    expect(res.body).toEqual({ reply, degraded: false });
    expect(mockModel).toHaveBeenCalledTimes(1);
  });

  it('passes a correction through', async () => {
    const reply = '❌ 📑 (networks.pdf، شريحة 3): نقطة الوصول عادةً لا توزّع عناوين IP؛ DHCP يقدمه الراوتر أو خادم.';
    mockModel.mockResolvedValueOnce({ text: reply });
    const res = await call(slidesBody('أظن الـ access point دايم يوزع عناوين IP بنفسه'));
    expect(res.body.reply).toBe(reply);
  });

  it('keeps partial and incorrect verdicts distinct', async () => {
    const reply = '⚠️ 📑 (networks.pdf، شريحة 3): صحيح أنه لاسلكي، لكن...\n❌ 🌐: ...';
    mockModel.mockResolvedValueOnce({ text: reply });
    const res = await call(slidesBody('access point لاسلكي ويوجّه بين الشبكات'));
    expect(res.body.reply).toContain('⚠️');
    expect(res.body.reply).toContain('❌');
  });

  it('sends the evaluation protocol and the current message once, with the excerpt label', async () => {
    mockModel.mockResolvedValueOnce({ text: '✅ ok' });
    await call(slidesBody('رسالة فريدة 123'));
    const params = mockModel.mock.calls[0][0] as any;
    expect(params.config.systemInstruction).toContain('❓');
    expect(params.contents.split('رسالة فريدة 123').length - 1).toBe(1);
    expect(params.contents).toContain('[networks.pdf · شريحة 3]');
  });
});

describe('course chat — no fabricated citations', () => {
  it('with no matching excerpts, no 📑 survives and no excerpt reaches the model', async () => {
    mockModel.mockResolvedValueOnce({ text: '✅ 📑 (networks.pdf، شريحة 9): كلام مخترع.' });
    const res = await call({ ...slidesBody('سؤال'), grounding: 'no_match', excerpts: [excerpt] });
    const params = mockModel.mock.calls[0][0] as any;
    expect(params.contents).not.toContain('<slide_excerpts>');
    expect(res.body.reply).not.toContain('📑');
    expect(res.body.reply).toContain('🌐');
  });

  it('downgrades a citation to a slide that was not sent', async () => {
    mockModel.mockResolvedValueOnce({ text: '✅ 📑 (networks.pdf، شريحة 7): ...\n❌ 📑 (networks.pdf، شريحة 3): ...' });
    const res = await call(slidesBody('x'));
    expect(res.body.reply).toBe('✅ 🌐: ...\n❌ 📑 (networks.pdf، شريحة 3): ...');
  });

  it('downgrades a citation to a file that was not sent (another course)', async () => {
    mockModel.mockResolvedValueOnce({ text: '✅ 📑 (cardiology.pdf، شريحة 3): ...' });
    const res = await call(slidesBody('x'));
    expect(res.body.reply).toBe('✅ 🌐: ...');
  });

  it('ignores slide excerpts sent with summaries_only grounding', async () => {
    mockModel.mockResolvedValueOnce({ text: '🌐 ...' });
    await call({ ...slidesBody('x'), grounding: 'summaries_only' });
    const params = mockModel.mock.calls[0][0] as any;
    expect(params.contents).not.toContain(excerpt.text);
  });
});
