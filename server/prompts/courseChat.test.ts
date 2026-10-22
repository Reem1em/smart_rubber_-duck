import { describe, expect, it } from 'vitest';

import { buildCourseChatPrompt, COURSE_CHAT_SYSTEM_INSTRUCTION, sanitizeGrounding, type CourseChatPromptInput } from './courseChat';

const excerpt = {
  source: 'networks.pdf',
  slide: 7,
  part: 2,
  partCount: 3,
  heading: 'Access Point (AP)',
  text: 'An access point connects wireless clients to a wired LAN. It does not route between networks.',
  visual: 'Laptop → AP → Switch (wired uplink)',
};

const base: CourseChatPromptInput = {
  courseTitle: 'Computer Networks',
  conceptNames: ['Access Point', 'Router'],
  history: [
    { role: 'student', text: 'وش الفرق بين السويتش والراوتر؟' },
    { role: 'duck', text: 'السويتش يربط أجهزة داخل نفس الشبكة...' },
  ],
  message: 'الـ Access Point يربط شبكتين مختلفتين على مستوى الراوتر',
  grounding: 'slides',
  excerpts: [excerpt],
  unavailableSources: [],
  summaries: [],
};

describe('COURSE_CHAT_SYSTEM_INSTRUCTION', () => {
  it('carries the claim-check protocol and the evidence rule', () => {
    expect(COURSE_CHAT_SYSTEM_INSTRUCTION).toContain('✅');
    expect(COURSE_CHAT_SYSTEM_INSTRUCTION).toContain('❌');
    expect(COURSE_CHAT_SYSTEM_INSTRUCTION).toContain('📑');
    expect(COURSE_CHAT_SYSTEM_INSTRUCTION).toContain('🌐');
    expect(COURSE_CHAT_SYSTEM_INSTRUCTION).toContain('القرب من الموضوع ليس دليلاً');
    expect(COURSE_CHAT_SYSTEM_INSTRUCTION).toContain('المقاطع المسترجعة من الشرائح لا تغطي هذه النقطة');
  });
});

describe('buildCourseChatPrompt', () => {
  it('labels excerpts with file, slide and part, and keeps the visual block', () => {
    const prompt = buildCourseChatPrompt(base);
    expect(prompt).toContain('<slide_excerpts>');
    expect(prompt).toContain('[networks.pdf · شريحة 7 (جزء 2/3)] — Access Point (AP)');
    expect(prompt).toContain('[عناصر مرئية]\nLaptop → AP → Switch (wired uplink)');
  });

  it('omits the part suffix for single-part slides', () => {
    const prompt = buildCourseChatPrompt({ ...base, excerpts: [{ ...excerpt, part: 1, partCount: 1 }] });
    expect(prompt).toContain('[networks.pdf · شريحة 7] — Access Point (AP)');
  });

  it('wraps student content in data delimiters and does not duplicate the current message', () => {
    const prompt = buildCourseChatPrompt(base);
    expect(prompt).toContain(`<student_message>\n${base.message}\n</student_message>`);
    expect(prompt.split(base.message).length - 1).toBe(1);
    expect(prompt).toContain('<conversation>');
    expect(prompt.indexOf('<conversation>')).toBeLessThan(prompt.indexOf('<student_message>'));
  });

  it('with no_match: no excerpt block, explicit "not covered" note, no 📑 allowed', () => {
    const prompt = buildCourseChatPrompt({ ...base, grounding: 'no_match', excerpts: [] });
    expect(prompt).not.toContain('<slide_excerpts>');
    expect(prompt).toContain('لم تُسترجع أي مقتطفات من الشرائح تغطي هذه الرسالة');
    expect(prompt).toContain('لا تستخدم 📑');
  });

  it('with summaries_only: summaries labelled as AI summaries, slide text unavailable', () => {
    const prompt = buildCourseChatPrompt({
      ...base,
      grounding: 'summaries_only',
      excerpts: [],
      summaries: [{ name: 'Access Point', summary: 'تربط الأجهزة اللاسلكية بالشبكة السلكية', keyPrinciples: [] }],
    });
    expect(prompt).toContain('نص الشرائح غير متاح لهذه المادة حالياً');
    expect(prompt).toContain('<concept_summaries>');
    expect(prompt).toContain('ليست نص الشرائح');
    expect(prompt).not.toContain('<slide_excerpts>');
  });

  it('lists unavailable sources so the model does not over-claim', () => {
    const prompt = buildCourseChatPrompt({ ...base, grounding: 'partial', unavailableSources: ['chapter2.pdf'] });
    expect(prompt).toContain('chapter2.pdf');
    expect(prompt).toContain('لا تستنتج أن الشرائح لا تذكر شيئاً');
  });
});

describe('sanitizeGrounding', () => {
  it('drops excerpts sent with no_match or summaries_only', () => {
    expect(sanitizeGrounding({ grounding: 'no_match', excerpts: [excerpt] }).excerpts).toEqual([]);
    expect(sanitizeGrounding({ grounding: 'summaries_only', excerpts: [excerpt] }).excerpts).toEqual([]);
  });

  it('defaults an invalid or missing grounding to summaries_only (no slide claims)', () => {
    const out = sanitizeGrounding({ grounding: 'trust-me', excerpts: [excerpt] });
    expect(out.grounding).toBe('summaries_only');
    expect(out.excerpts).toEqual([]);
    expect(sanitizeGrounding({}).grounding).toBe('summaries_only');
  });

  it('downgrades slides with no valid excerpts to no_match', () => {
    expect(sanitizeGrounding({ grounding: 'slides', excerpts: [{ text: 'no source' }] }).grounding).toBe('no_match');
    expect(sanitizeGrounding({ grounding: 'slides' }).grounding).toBe('no_match');
  });

  it('caps the excerpt count, per-excerpt text and total characters', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...excerpt, slide: i + 1, text: 'x'.repeat(5000), visual: '' }));
    const out = sanitizeGrounding({ grounding: 'slides', excerpts: many });
    expect(out.excerpts.length).toBeLessThanOrEqual(6);
    expect(out.excerpts.every((e) => e.text.length <= 2000)).toBe(true);
    const total = out.excerpts.reduce((n, e) => n + e.text.length + (e.visual?.length ?? 0), 0);
    expect(total).toBeLessThanOrEqual(8000);
  });

  it('keeps summaries only for summaries_only', () => {
    const summaries = [{ name: 'AP', summary: 's', keyPrinciples: ['p'] }];
    expect(sanitizeGrounding({ grounding: 'summaries_only', summaries }).summaries).toHaveLength(1);
    expect(sanitizeGrounding({ grounding: 'slides', excerpts: [excerpt], summaries }).summaries).toEqual([]);
  });
});
