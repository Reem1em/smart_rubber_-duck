/**
 * Course-grounded tutor chat ("اسأل كواكلي"). The duck explains a concept the
 * student did not grasp, then pushes them straight back to explaining it aloud.
 */

export const COURSE_CHAT_SYSTEM_INSTRUCTION = `أنت "كواكلي" (Quakly)، مدرّس المادة الشخصي داخل منصة كواكلي.

أسلوبك الإلزامي:
1. الإجابة تحت 120 كلمة دائماً. لا مقدمات ولا ترحيب ولا تكرار للسؤال.
2. ابدأ بالحدس: ليش هذا المفهوم موجود أصلاً وأي مشكلة يحل، قبل أي تعريف.
3. استخدم تشبيهاً واحداً من الحياة اليومية السعودية (سوق، طابور، دوام، قهوة، طريق، جوال) — تشبيه واحد فقط وواضح.
4. ممنوع التعريفات الأكاديمية الجافة أو النسخ من الكتاب. اشرح الـ"ليش" و"كيف يشتغل".
5. ابقَ داخل سياق مادة الطالب المرفقة؛ إذا سأل عن شيء خارجها قل ذلك بسطر واحد ووجّهه.
6. اختم دائماً بسطر أخير: إما سؤال تحقق قصير، أو دعوة صريحة يشرح فيها المفهوم بصوته.
7. الرياضيات بصيغة LaTeX داخل $$ ... $$ في سطر مستقل مع سطر فارغ قبله وبعده.
8. اكتب نصاً عادياً بلهجة سعودية عصرية خفيفة — بدون JSON وبدون عناوين ماركداون ثقيلة.`;

export interface CourseChatTurn {
  role: 'student' | 'duck';
  text: string;
}

export interface CourseChatPromptInput {
  courseTitle: string;
  /** Names of the course's extracted concepts, for grounding and scope control. */
  conceptNames: string[];
  /** The concept the student tapped "اشرحه لي" on, when the chat was opened that way. */
  focusConcept?: { name: string; summary?: string; keyPrinciples?: string[] };
  history: CourseChatTurn[];
  message: string;
}

const MAX_HISTORY_TURNS = 6;
const MAX_CONCEPTS_LISTED = 40;

/** Builds one grounded chat turn, trimming context to keep the payload cheap. */
export function buildCourseChatPrompt(input: CourseChatPromptInput): string {
  const { courseTitle, focusConcept, message } = input;

  const concepts = input.conceptNames
    .slice(0, MAX_CONCEPTS_LISTED)
    .map((name) => `- ${name}`)
    .join('\n');

  const focus = focusConcept
    ? `\nالمفهوم محل السؤال: "${focusConcept.name}".${
        focusConcept.summary ? `\nملخصه من مادة الطالب: ${focusConcept.summary.slice(0, 600)}` : ''
      }${
        focusConcept.keyPrinciples?.length
          ? `\nأركانه: ${focusConcept.keyPrinciples.slice(0, 5).join(' • ').slice(0, 600)}`
          : ''
      }\n`
    : '';

  const history = input.history
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => `${turn.role === 'student' ? 'الطالب' : 'كواكلي'}: ${turn.text.slice(0, 700)}`)
    .join('\n');

  return `مادة الطالب: "${courseTitle}".
مفاهيم المادة المستخرجة:
${concepts || '- (لم تُستخرج مفاهيم بعد)'}
${focus}${history ? `\nسياق المحادثة السابقة:\n${history}\n` : ''}
سؤال الطالب الآن:
"${message.slice(0, 2000)}"

أجب الآن بشرح واحد مركّز تحت 120 كلمة.`;
}
