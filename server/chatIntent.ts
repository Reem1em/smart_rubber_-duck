/**
 * Intent routing for the course chat ("اسأل كواكلي").
 *
 * The chat used to run on the full tutor agent prompt, whose Socratic modes end every turn with
 * a question — so the student got questions back no matter what they asked. Now:
 *   classifyIntent(msg)          → 'answer' | 'ask_question' | 'clarify' | 'other'   (default 'answer')
 *   generateResponse(intent, ctx) → one model call with that intent's directive, plus a guard that
 *                                   never serves a question-only turn the student didn't ask for.
 *
 * Classification is rule-based (no extra model call), keeping the chat inside its latency budget.
 */
import type { CourseChatTurn } from './prompts/courseChat';

export type ChatIntent = 'answer' | 'ask_question' | 'clarify' | 'other';

/** Strips diacritics/tatweel and unifies alef/ya/ta-marbuta forms so patterns match dialect spellings. */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

/** Explicit requests to be quizzed (MSA + Saudi dialect + English). */
const QUIZ_PATTERNS: RegExp[] = [
  /اختبر(ني|نى|يني)/,
  /امتحن(ي|ني)/,
  /اسال(ني|يني)/,
  /(عطني|اعطني|ابي|ابغي|ابغا|اريد|بدي|هات|حط|خلني اجاوب على)\s*(لي\s*)?(سؤال|اسئله|كويز|تمرين|اختبار)/,
  /(سؤال|اسئله|تمرين|كويز)\s*(تدريبي|تدريبيه|اختبار|اتدرب)/,
  /\bquiz me\b|\btest me\b|\bask me\b|\bgive me (a )?(question|quiz)/,
];

/** Greetings, thanks and acknowledgements with no request in them. */
const SMALL_TALK = new RegExp(
  '^(السلام عليكم|سلام|هلا|هلا والله|مرحبا|اهلا|صباح الخير|مساء الخير|شكرا|شكرا لك|مشكور|يعطيك العافيه|الله يعطيك العافيه|تمام|طيب|اوكي|ok|okay|thanks|thank you|hi|hello)' +
    '([\\s!.,،؟?]*(يا كواكلي|كواكلي|جزيلا|لك|مره|مرره))*[\\s!.,،؟?😊🙏👍]*$'
);

/** Words that carry no subject on their own: a message made only of these needs context. */
const FILLER = new Set([
  'هذا', 'هذي', 'هذه', 'ذا', 'ذي', 'هاذا', 'وش', 'ايش', 'شو', 'ويش', 'يعني', 'كيف', 'ليش', 'ليه',
  'اشرح', 'اشرحه', 'اشرحها', 'وضح', 'وضحه', 'فهمني', 'مافهمت', 'ما', 'فهمت', 'ها', 'هاه', 'طيب', 'و', 'هو', 'هي',
  'لي', 'كمل', 'زيد', 'this', 'that', 'what', 'explain', 'it', 'huh', 'why', 'how',
]);

/** Short follow-ups that mean "explain the last thing again / more" — an answer, given context. */
const FOLLOW_UP = /^(مافهمت|ما فهمت|ما وضحت|وضح اكثر|اشرح اكثر|اشرح مره ثانيه|كمل|زيد|اعد|عيد|ليش|كيف|يعني)/;

const words = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * A turn is question-only when every sentence in it is a question: it gives the student nothing
 * but another thing to answer. LaTeX blocks are ignored so `$$...$$` can't hide a `?`.
 */
export function isQuestionOnly(text: string): boolean {
  const body = text.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$\n]*\$/g, ' ');
  const sentences = body
    .split(/(?<=[.!؟?\n])/)
    .map((s) => s.trim())
    .filter((s) => /\p{L}{2,}/u.test(s));
  return sentences.length > 0 && sentences.every((s) => /[؟?]\s*[\p{Extended_Pictographic}\s]*$/u.test(s));
}

export interface IntentContext {
  history?: CourseChatTurn[];
  /** A concept the chat was opened on: "اشرح" alone then has a clear subject. */
  hasFocusConcept?: boolean;
}

export function classifyIntent(message: string, ctx: IntentContext = {}): ChatIntent {
  const msg = normalizeArabic(message);
  if (!msg) return 'clarify';

  if (QUIZ_PATTERNS.some((re) => re.test(msg))) return 'ask_question';
  if (SMALL_TALK.test(msg)) return 'other';

  const history = ctx.history ?? [];
  const lastDuck = [...history].reverse().find((t) => t.role === 'duck');
  const hasSubjectContext = !!ctx.hasFocusConcept || !!lastDuck;

  const w = words(msg);
  const fillerOnly = w.length === 0 || (w.length <= 4 && w.every((x) => FILLER.has(x)));
  if (fillerOnly) {
    // "مافهمت" / "اشرح" after an answer means: explain that again — answer, don't interrogate.
    if (hasSubjectContext && (FOLLOW_UP.test(msg) || w.length > 0)) return 'answer';
    // Never two clarifying questions in a row: if the last duck turn already asked, answer anyway.
    if (lastDuck && isQuestionOnly(lastDuck.text)) return 'answer';
    return 'clarify';
  }

  return 'answer';
}

/** Per-intent instruction appended to the chat system prompt. */
export const INTENT_DIRECTIVE: Record<ChatIntent, string> = {
  answer:
    'نية الطالب: يريد إجابة. أجب مباشرة وبشكل كامل عن رسالته الأخيرة. لا تطرح عليه أي سؤال ولا تختم بسؤال أو بطلب أن يشرح هو. إذا كانت رسالته "مافهمت" أو ما يشبهها فأعد شرح آخر نقطة بطريقة أبسط وبمثال.',
  ask_question:
    'نية الطالب: طلب صراحة أن تختبره. اطرح سؤالاً واحداً واضحاً من مادته عن المفهوم المعني (أو أهم مفهوم في المحادثة)، ولا تذكر الإجابة.',
  clarify:
    'نية الطالب غير واضحة. اطرح سؤال توضيح واحداً قصيراً فقط يحدد ماذا يقصد، ويمكنك اقتراح خيارين من مفاهيم المادة. لا تضف أسئلة أخرى.',
  other: 'رسالة الطالب تحية أو شكر. رد بجملة أو جملتين ودودتين ومختصرتين، بلا أسئلة.',
};

/** Stronger directive for the single retry when an answer came back as questions only. */
const ANSWER_RETRY_DIRECTIVE =
  'ردك السابق كان أسئلة فقط، وهذا مرفوض هنا. اكتب الآن إجابة تقريرية مباشرة بدون أي علامة استفهام.';

/** Served only if the model returns question-only text twice for a non-quiz request. */
export const GUARD_REPLY =
  'ما قدرت أطلع لك جواب واضح لهالرسالة من مصادر المادة. اكتب اسم المفهوم أو النقطة اللي تبيها وأشرحها لك مباشرة.';

export interface GenerateResponseContext {
  prompt: string;
  /** Base system instruction (persona, verdict and citation rules, scope mandate). */
  systemInstruction: string;
  history: CourseChatTurn[];
  /** One model call; returns the raw reply text. */
  callModel: (params: { contents: string; systemInstruction: string }) => Promise<string>;
}

export interface GeneratedResponse {
  reply: string;
  intent: ChatIntent;
  /** True when the question-only guard had to intervene. */
  guarded: boolean;
}

export async function generateResponse(intent: ChatIntent, ctx: GenerateResponseContext): Promise<GeneratedResponse> {
  const system = `${ctx.systemInstruction}\n\n${INTENT_DIRECTIVE[intent]}`;
  const first = (await ctx.callModel({ contents: ctx.prompt, systemInstruction: system })).trim();
  if (!first) throw new Error('Empty chat reply');

  // Only an explicit quiz request or a single clarification may come back as a question.
  const lastDuck = [...ctx.history].reverse().find((t) => t.role === 'duck');
  const questionAllowed =
    intent === 'ask_question' || (intent === 'clarify' && !(lastDuck && isQuestionOnly(lastDuck.text)));
  if (questionAllowed || !isQuestionOnly(first)) return { reply: first, intent, guarded: false };

  const retry = (
    await ctx.callModel({ contents: ctx.prompt, systemInstruction: `${system}\n\n${ANSWER_RETRY_DIRECTIVE}` })
  ).trim();
  if (retry && !isQuestionOnly(retry)) return { reply: retry, intent, guarded: true };
  return { reply: GUARD_REPLY, intent, guarded: true };
}
