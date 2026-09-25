/**
 * Shared "Math Engine" activation logic and prompt fragments.
 *
 * A single source of truth for:
 * 1. STEM detection (Mathematics / Linear Algebra / Calculus) across Arabic + English material.
 * 2. The strict isolated-LaTeX display contract that prevents Arabic RTL/LTR clashes.
 * 3. The dual challenge modes (Math Bug-Hunting / Think-Aloud Strategy).
 */

/** Arabic + English tokens that mark a course as Mathematics / Linear Algebra / Calculus. */
const STEM_KEYWORDS: readonly string[] = [
  // Arabic
  'رياضيات',
  'رياضي',
  'جبر',
  'مصفوف',
  'محدد',
  'متجه',
  'تفاضل',
  'مشتق',
  'تكامل',
  'نهايات',
  'معادل',
  'دالة',
  'دوال',
  'كسور',
  'أسس',
  'لوغاريتم',
  'مثلثات',
  'هندسة تحليلية',
  'إحصاء',
  'احتمال',
  // English
  'math',
  'algebra',
  'linear algebra',
  'matrix',
  'matrices',
  'determinant',
  'eigen',
  'vector',
  'calculus',
  'derivative',
  'differenti',
  'integral',
  'integration',
  'limit',
  'function',
  'logarithm',
  'trigonometr',
  'statistic',
  'probability',
];

/**
 * Activates the Math Engine pipeline when any supplied text (course name, concept
 * name/summary, key principles, extracted material) mentions a STEM topic.
 */
export function isStemTopic(...texts: Array<unknown>): boolean {
  const haystack = texts
    .flatMap((t) => (Array.isArray(t) ? t : [t]))
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;
  return STEM_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * Isolated LaTeX display contract. Every formula lives on its own `$$ ... $$` line
 * surrounded by blank lines so Arabic RTL text never wraps around LTR math.
 */
export const LATEX_DISPLAY_RULES = `قاعدة العرض الرياضي الصارمة (ISOLATED LATEX RULE):
1. يُمنع منعاً باتاً دمج أي مصفوفة أو معادلة أو كسر داخل سطر نص عربي (يسبب قلب الحروف والأرقام RTL/LTR).
2. كل صيغة رياضية تُكتب وحدها في كتلة عرض معزولة: سطر فارغ، ثم $$ ... $$ في سطر مستقل، ثم سطر فارغ.
3. المتغيرات والرموز المفردة داخل الجملة العربية (m، n، a_{ij}، A، \\det(A)) تُكتب بعلامة دولار مفردة inline مثل: $m$ ، $n$ ، $a_{ij}$ ، $A^{-1}$ — ويُمنع وضعها في كتلة $$ ... $$ لأنها تقطع السطر وتكسر اتجاه النص.
4. كتل العرض $$ ... $$ محجوزة للمعادلات والمصفوفات المستقلة فقط.
5. استخدم بيئات LaTeX القياسية حصراً:
   - المصفوفات: $$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$$
   - المحددات: $$\\det(A) = \\begin{vmatrix} 1 & 4 \\\\ 2 & 3 \\end{vmatrix}$$
   - الكسور: $$\\frac{3x + 1}{x - 2}$$
   - الأسس والجذور: $$x^{2}$$ ، $$\\sqrt{x^{2} + 1}$$ ، $$A^{-1}$$ ، $$f^{-1}(x)$$
   - التفاضل: $$\\frac{dy}{dx} = 3x^{2} + 8x$$
   - التكامل: $$\\int_{0}^{2} (2x + 1)\\,dx$$
   - المتجهات: $$\\vec{u} = \\langle 2, -3, 1 \\rangle$$
6. يُمنع رسم المصفوفات بالأقواس النصية [ 1 2 ] أو بالخطوط | 1 2 |، ويُمنع كتابة الكسور بالشرطة المائلة (a)/(b)، ويُمنع الترميز البرمجي مثل [[1,2],[3,4]] أو inv(A) أو sqrt(x) أو x^2 خارج LaTeX.
7. النص العربي يبقى وصفياً قصيراً فقط، والصيغ داخل $ ... $ (مفرد) أو $$ ... $$ (مستقل).`;

/** Bans abstract/definitional prompts; every STEM challenge must be concrete and numerical. */
export const BAN_THEORY_RULE = `حظر الحشو النظري (BAN THEORETICAL FILLER):
1. يُمنع منعاً باتاً أي سؤال تعريفي أو لفظي مجرد مثل: "ما هو تعريف المصفوفة؟"، "اشرح معنى المحدد"، "عدد خصائص المشتقة"، "قارن بين ...".
2. كل تحد يجب أن يحتوي على أرقام محسوسة ومصفوفة أو معادلة أو تكامل فعلي يمكن حسابه.
3. ممنوع المقدمات والترحيب؛ ابدأ مباشرة بالمسألة العددية.
4. النص الوصفي المرافق أقل من 50 كلمة.`;

/** Mode A + Mode B specification shared by every STEM challenge generator. */
export const DUAL_CHALLENGE_MODES = `نمطا التحدي الإلزاميان (DUAL CHALLENGE MODES) — اختر نمطاً واحداً فقط:

النمط A — صيد الخطأ الحسابي (Math Bug-Hunting):
- اعرض المعطيات العددية في كتلة $$ ... $$ معزولة.
- ثم اعرض خطوة حسابية واحدة مختصرة قام بها "كواكلي" في كتلة $$ ... $$ معزولة تحتوي على خطأ واحد فقط لا غير (خطأ إشارة أو خطأ عملية حسابية دقيق وغير صارخ).
- الخطأ يجب أن يكون خفياً ومعقولاً (مثل + بدلاً من − في قاعدة المحدد، أو ضرب الصف في الصف بدل الصف في العمود).
- أنهِ بالتحدي الصوتي: "وين الغلطة في خطوتي؟ اشرح لي بصوتك إيش الخطوة الصح وليه."

النمط B — الشرح الصوتي للخطوة الأولى (Think-Aloud Strategy):
- اعرض مصفوفة أو مسألة عددية كاملة في كتلة $$ ... $$ معزولة، بدون أي حل.
- أنهِ بالتحدي الصوتي: "بدون ما تحسب الناتج، اشرح لي بصوتك: إيش أول خطوة عددية راح تبدأ فيها وليه؟"`;

/** Full Math Engine preamble injected into STEM prompts. */
export const MATH_ENGINE_DIRECTIVES = `${LATEX_DISPLAY_RULES}

${BAN_THEORY_RULE}

${DUAL_CHALLENGE_MODES}`;

/**
 * Formatting contract for short concept fields (name / coreFocus / summary / keyPrinciples).
 * These render inside headings and pills, so a display block there would be unreadable.
 */
export const CONCEPT_MATH_FORMATTING = `تنسيق الرموز الرياضية داخل نصوص المفاهيم (CONCEPT MATH FORMATTING):
1. حقول المفهوم القصيرة (name, coreFocus, summary, keyPrinciples) نصوص عربية قصيرة تُعرض داخل عناوين وبطاقات؛ استخدم فيها الدولار المفرد فقط للمتغيرات: $m$ ، $n$ ، $a_{ij}$ ، $A^{-1}$ ، $\\det(A)$.
2. يُمنع منعاً باتاً استخدام $$ ... $$ داخل هذه الحقول القصيرة (يظهر كنص خام ويكسر تخطيط البطاقة).
3. الأفضل دائماً الكلمة العربية الواضحة بدل الرمز عند الإمكان: اكتب "عدد الصفوف" بدلاً من $m$ إن كان المعنى واضحاً.
4. المعادلات أو المصفوفات المستقلة الكاملة فقط تُكتب في كتلة معزولة $$ ... $$ يسبقها سطر فارغ ويليها سطر فارغ، ولا تُدمج أبداً داخل سطر عربي.`;
