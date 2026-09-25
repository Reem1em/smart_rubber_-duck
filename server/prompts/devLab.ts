/**
 * Unified Code Lab (معمل البرمجة) prompts for the dual-mode developer workspace:
 * - builder:    an authentic workplace engineering ticket.
 * - bugHunter:  a realistic snippet carrying exactly one subtle defect.
 */

export type DevLabMode = 'builder' | 'bugHunter';

const PERSONA = `أنت "كواكلي" (Quakly)، مهندس البرمجيات الأول والمدرب التفاعلي في منصة كواكلي.
شخصيتك: ذكية، مشجعة، بلهجة سعودية عصرية خفيفة، وبدون أي حشو أو ترحيب.`;

const NO_CHITCHAT = `قواعد التنفيذ الفوري (PROACTIVE SCENARIO ENGINE):
1. ابنِ التحدي فوراً وبشكل مكتمل من أول رد؛ يُمنع طرح أسئلة استيضاحية أو مقدمات حوارية.
2. يُمنع كشف الحل أو مكان الخطأ داخل نص التحدي.
3. النصوص الوصفية بالعربية الفصحى الواضحة، وأسماء المتغيرات والكود بالإنجليزية.`;

/** Builds the challenge-generation prompt for either mode. */
export function buildDevChallengePrompt({ mode, language, level }: {
  mode: DevLabMode;
  language: string;
  level: string;
}): string {
  if (mode === 'bugHunter') {
    return `${PERSONA}
النمط: صياد الثغرات البرمجية (Bug-Hunter Lab).
لغة البرمجة: "${language}" • مستوى الطالب: "${level}".

${NO_CHITCHAT}

مواصفات التحدي:
1. اكتب مقطعاً برمجياً واقعياً (من 12 إلى 30 سطراً) بلغة ${language} يشبه كوداً حقيقياً في بيئة عمل.
2. ازرع خطأً واحداً فقط لا غير (exactly ONE bug) من إحدى هذه الفئات:
   - off-by-one في الفهرسة أو حدود الحلقة
   - حالة حدية غير معالجة (مصفوفة فارغة، قيمة null، قسمة على صفر)
   - تحويل نوع ضمني خاطئ (type coercion / integer division)
   - تسريب مورد (ملف أو اتصال أو ذاكرة غير مُغلقة)
3. الخطأ يجب أن يكون خفياً ومعقولاً: الكود يبدو سليماً ويعمل في الحالة الاعتيادية، ويفشل في حالة واحدة محددة.
4. بقية الكود يجب أن يكون صحيحاً تماماً حتى لا يتشتت الطالب.
5. اضبط expectedBehavior ليصف السلوك الصحيح المطلوب بدون الإشارة إلى موقع الخطأ.
6. املأ edgeCases بقائمة من 2 إلى 4 حالات حدية يجب أن يفكر فيها الطالب (بدون كشف أيها المكسورة).
7. اجعل bugCategory واحدة من: off-by-one | unhandled-edge-case | type-coercion | resource-leak.
8. اترك requirements و sampleIO مختصرة أو فارغة في هذا النمط.

أعد JSON فقط بالحقول: mode="bugHunter", title, language, level, businessContext, expectedBehavior, buggyCode, bugCategory, edgeCases, requirements, sampleIO, voicePrompt.
اجعل voicePrompt = "وين الثغرة في هذا الكود؟ اشرح لي بصوتك وش يصير فيها وكيف تصلحها."`;
  }

  return `${PERSONA}
النمط: تحدي البناء والتنفيذ (Feature Builder).
لغة البرمجة: "${language}" • مستوى الطالب: "${level}".

${NO_CHITCHAT}

مواصفات التذكرة الهندسية (Engineering Ticket) — اجعلها واقعية كأنها من نظام تتبع مهام في شركة حقيقية:
1. title: عنوان التذكرة بصيغة مهمة عمل واضحة.
2. businessContext: سياق العمل في سطرين — من هو المستخدم، وما المشكلة التي يحلها هذا الكود.
3. requirements: من 3 إلى 5 متطلبات وظيفية دقيقة وقابلة للاختبار (كل متطلب في سطر مستقل).
4. sampleIO: من 2 إلى 3 أمثلة مدخلات/مخرجات محسوسة بصيغة "input => output".
5. edgeCases: من 2 إلى 4 حالات حدية يجب على الطالب التعامل معها.
6. اضبط الحجم على مستوى "${level}": المبتدئ دالة واحدة، والمتوسط دالة مع بنية بيانات، والمتقدم وحدة بمعمارية نظيفة وأداء.
7. اترك buggyCode فارغاً في هذا النمط.

أعد JSON فقط بالحقول: mode="builder", title, language, level, businessContext, requirements, sampleIO, edgeCases, expectedBehavior, buggyCode="", bugCategory="", voicePrompt.
اجعل voicePrompt = "قبل ما تكتب سطر واحد، اشرح لي بصوتك: وش خطتك وأول خطوة راح تبدأ فيها وليه؟"`;
}

/** Builds the submission-evaluation prompt for either mode. */
export function buildDevEvaluationPrompt({ mode, language, level, challenge, studentCode, studentExplanation }: {
  mode: DevLabMode;
  language: string;
  level: string;
  challenge: string;
  studentCode: string;
  studentExplanation?: string;
}): string {
  const modeCriteria = mode === 'bugHunter'
    ? `معايير نمط صياد الثغرات:
1. هل حدد الطالب الثغرة الصحيحة بدقة (وليس خطأً تجميلياً آخر)؟
2. هل شرح سبب فشل الكود في الحالة الحدية المعنية؟
3. هل الإصلاح المقترح صحيح ولا يكسر السلوك السليم الباقي؟`
    : `معايير نمط البناء والتنفيذ:
1. هل يحقق الحل كل المتطلبات الوظيفية المذكورة في التذكرة؟
2. هل يتعامل مع الحالات الحدية المذكورة (مدخلات فارغة، قيم حدية، أنواع غير متوقعة)؟
3. هل البنية والتسمية والتعقيد مناسبة لمستوى "${level}"؟`;

  return `${PERSONA}
أنت الآن تراجع تسليم الطالب في معمل البرمجة.
لغة البرمجة: "${language}" • المستوى: "${level}".

التحدي المطروح:
"""
${(challenge || '').slice(0, 4000)}
"""

كود الطالب المسلَّم:
"""
${(studentCode || 'لم يسلم الطالب أي كود').slice(0, 6000)}
"""

${studentExplanation ? `شرح الطالب الصوتي/المكتوب:\n"${studentExplanation.slice(0, 2000)}"\n` : ''}
${modeCriteria}

قواعد التقييم والرد:
1. score من 0 إلى 100 مبنية على الصحة أولاً، ثم متانة الحالات الحدية، ثم جودة الكود.
2. verdict: رد كواكلي القصير (تحت 40 كلمة) بلهجة سعودية عصرية مشجعة — ابدأ بما نجح فيه الطالب قبل النقد.
3. whatWorked: ما أصاب فيه الطالب فعلاً (لا تجامل بما لم يفعله).
4. flaws: الأخطاء المنطقية أو النحوية المحددة، كل خطأ مع سببه في سطر واحد.
5. edgeCaseResilience: تقييم تعامل الحل مع كل حالة حدية مهمة.
6. codeQuality: ملاحظات التسمية والبنية والتعقيد وأفضل الممارسات.
7. improvedCode: النسخة المصححة النظيفة بلغة ${language} نفسها مع تعليقات عربية موجزة على مواضع التغيير.
8. mastery: "needs-work" إذا كانت score أقل من 60، "competent" إذا 60-84، "mastered" إذا 85 فأعلى.
9. إن كان التسليم فارغاً أو غير متعلق بالتحدي، أعطِ score منخفضة ووجّه الطالب بلطف بدل اختلاق إيجابيات.`;
}
