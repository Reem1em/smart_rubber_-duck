import { describe, expect, it, vi } from 'vitest';

import {
  GUARD_REPLY,
  INTENT_DIRECTIVE,
  classifyIntent,
  generateResponse,
  isQuestionOnly,
  type ChatIntent,
} from './chatIntent';
import type { CourseChatTurn } from './prompts/courseChat';

describe('classifyIntent', () => {
  it.each<[string, ChatIntent]>([
    ['وش الفرق بين TCP و UDP؟', 'answer'],
    ['ما هو عنوان البث للشبكة 192.168.1.0/24؟', 'answer'],
    ['اشرح لي الـ subnetting', 'answer'],
    ['What is a subnet mask?', 'answer'],
    ['اختبرني في الشبكات', 'ask_question'],
    ['اسألني سؤال عن TCP', 'ask_question'],
    ['عطني سؤال تدريبي', 'ask_question'],
    ['أبي أسئلة اختبار على الفصل الثاني', 'ask_question'],
    ['quiz me on routing', 'ask_question'],
    ['السلام عليكم', 'other'],
    ['شكراً يا كواكلي 🙏', 'other'],
    ['هذا؟', 'clarify'],
    ['وش ذا', 'clarify'],
  ])('%s → %s', (msg, intent) => {
    expect(classifyIntent(msg)).toBe(intent);
  });

  it('a follow-up like "مافهمت" after an answer means: explain again', () => {
    const history: CourseChatTurn[] = [
      { role: 'student', text: 'وش يعني TCP؟' },
      { role: 'duck', text: 'TCP بروتوكول نقل موثوق يضمن وصول البيانات بالترتيب.' },
    ];
    expect(classifyIntent('مافهمت', { history })).toBe('answer');
  });

  it('"اشرح" alone has a subject when the chat is focused on a concept', () => {
    expect(classifyIntent('اشرح', { hasFocusConcept: true })).toBe('answer');
    expect(classifyIntent('اشرح')).toBe('clarify');
  });

  it('ambiguous twice in a row → one clarifying question, then an answer', () => {
    expect(classifyIntent('هذا؟')).toBe('clarify');
    const history: CourseChatTurn[] = [
      { role: 'student', text: 'هذا؟' },
      { role: 'duck', text: 'تقصد أي مفهوم بالضبط: TCP أو UDP؟' },
    ];
    expect(classifyIntent('هذا؟', { history })).toBe('answer');
  });
});

describe('isQuestionOnly', () => {
  it.each([
    ['تقدر تشرح لي وش فهمت؟', true],
    ['وش تقصد؟ تبي TCP ولا UDP؟', true],
    ['TCP بروتوكول موثوق. هل فهمت؟', false],
    ['الناتج هو:\n\n$$x = \\frac{a}{b}?$$\n\nوهذا يكمل الحل.', false],
    ['✅ صحيح: TCP يضمن الترتيب.', false],
  ])('%s → %s', (text, expected) => {
    expect(isQuestionOnly(text)).toBe(expected);
  });
});

describe('generateResponse', () => {
  const base = { prompt: 'PROMPT', systemInstruction: 'BASE', history: [] as CourseChatTurn[] };

  it('factual question → an answer, with the answer directive, in one model call', async () => {
    const callModel = vi.fn(async () => 'TCP بروتوكول نقل موثوق يضمن وصول البيانات بالترتيب.');
    const intent = classifyIntent('وش وظيفة TCP؟');
    const r = await generateResponse(intent, { ...base, callModel });
    expect(r).toEqual({ reply: 'TCP بروتوكول نقل موثوق يضمن وصول البيانات بالترتيب.', intent: 'answer', guarded: false });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel.mock.calls[0][0].systemInstruction).toContain(INTENT_DIRECTIVE.answer);
  });

  it('request to be quizzed → a question is served as-is', async () => {
    const callModel = vi.fn(async () => 'ما الفرق بين TCP و UDP من حيث الموثوقية؟');
    const r = await generateResponse(classifyIntent('اختبرني في TCP'), { ...base, callModel });
    expect(r.intent).toBe('ask_question');
    expect(isQuestionOnly(r.reply)).toBe(true);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('ambiguous → exactly one clarifying question, then the next turn is an answer', async () => {
    const clarify = vi.fn(async () => 'تقصد أي مفهوم: TCP أو UDP؟');
    const first = await generateResponse(classifyIntent('هذا؟'), { ...base, callModel: clarify });
    expect(first.intent).toBe('clarify');
    expect(isQuestionOnly(first.reply)).toBe(true);

    const history: CourseChatTurn[] = [
      { role: 'student', text: 'هذا؟' },
      { role: 'duck', text: first.reply },
    ];
    const answer = vi.fn(async () => 'أشرح لك TCP: بروتوكول نقل موثوق.');
    const second = await generateResponse(classifyIntent('هذا؟', { history }), { ...base, history, callModel: answer });
    expect(second.intent).toBe('answer');
    expect(isQuestionOnly(second.reply)).toBe(false);
  });

  it('guard: an answer that comes back as questions only is retried once', async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce('وش تعرف أنت عن TCP؟')
      .mockResolvedValueOnce('TCP يضمن وصول البيانات بالترتيب.');
    const r = await generateResponse('answer', { ...base, callModel });
    expect(r).toEqual({ reply: 'TCP يضمن وصول البيانات بالترتيب.', intent: 'answer', guarded: true });
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it('guard: never two consecutive question-only turns — a second clarify after a question is blocked', async () => {
    const history: CourseChatTurn[] = [
      { role: 'student', text: 'هذا' },
      { role: 'duck', text: 'تقصد TCP أو UDP؟' },
    ];
    const callModel = vi.fn(async () => 'طيب، أي جزء بالضبط؟');
    const r = await generateResponse('clarify', { ...base, history, callModel });
    expect(r.reply).toBe(GUARD_REPLY);
    expect(isQuestionOnly(r.reply)).toBe(false);
    expect(r.guarded).toBe(true);
  });
});
