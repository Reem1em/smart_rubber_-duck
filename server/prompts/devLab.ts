/**
 * Unified Code Lab (معمل البرمجة) prompts for the dual-mode developer workspace:
 * - builder:    an authentic workplace engineering ticket.
 * - bugHunter:  a realistic snippet carrying exactly one subtle defect.
 */

import type { CodeExecutionReport, CustomLabTestResult } from '../../src/types';
import { DETERMINISTIC_EVALUATION_MANDATE, buildExecutionBlock } from '../execution';

export type DevLabMode = 'builder' | 'bugHunter';

/** One student-defined test case for the Custom Lab Assignment judge. */
export interface CustomLabTestCase {
  input: string;
  expectedOutput: string;
}

const PERSONA = `أنت "كواكلي" (Quakly)، مهندس البرمجيات الأول والمدرب التفاعلي في منصة كواكلي.
شخصيتك: ذكية، مشجعة، بلهجة سعودية عصرية خفيفة، وبدون أي حشو أو ترحيب.`;

const NO_CHITCHAT = `قواعد التنفيذ الفوري (PROACTIVE SCENARIO ENGINE):
1. ابنِ التحدي فوراً وبشكل مكتمل من أول رد؛ يُمنع طرح أسئلة استيضاحية أو مقدمات حوارية.
2. يُمنع كشف الحل أو مكان الخطأ داخل نص التحدي.
3. النصوص الوصفية بالعربية الفصحى الواضحة، وأسماء المتغيرات والكود بالإنجليزية.`;

/** Persona followed by the course scope, when the lab was opened inside a course. */
const withScope = (scopeBlock: string): string => (scopeBlock ? `${PERSONA}\n\n${scopeBlock}` : PERSONA);

/** Builds the challenge-generation prompt for either mode. */
export function buildDevChallengePrompt({ mode, language, level, scopeBlock = '' }: {
  mode: DevLabMode;
  language: string;
  level: string;
  /** Course isolation rules from buildLabScopeBlock ('' outside a course). */
  scopeBlock?: string;
}): string {
  const persona = withScope(scopeBlock);
  if (mode === 'bugHunter') {
    return `${persona}
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

  return `${persona}
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
export function buildDevEvaluationPrompt({ mode, language, level, challenge, studentCode, studentExplanation, scopeBlock = '', execution = null }: {
  mode: DevLabMode;
  language: string;
  level: string;
  challenge: string;
  studentCode: string;
  studentExplanation?: string;
  /** Course isolation rules from buildLabScopeBlock ('' outside a course). */
  scopeBlock?: string;
  /** Real Pyodide results; null when the language cannot run in the browser. */
  execution?: CodeExecutionReport | null;
}): string {
  const persona = withScope(scopeBlock);
  const modeCriteria = mode === 'bugHunter'
    ? `معايير نمط صياد الثغرات:
1. هل حدد الطالب الثغرة الصحيحة بدقة (وليس خطأً تجميلياً آخر)؟
2. هل شرح سبب فشل الكود في الحالة الحدية المعنية؟
3. هل الإصلاح المقترح صحيح ولا يكسر السلوك السليم الباقي؟`
    : `معايير نمط البناء والتنفيذ:
1. هل يحقق الحل كل المتطلبات الوظيفية المذكورة في التذكرة؟
2. هل يتعامل مع الحالات الحدية المذكورة (مدخلات فارغة، قيم حدية، أنواع غير متوقعة)؟
3. هل البنية والتسمية والتعقيد مناسبة لمستوى "${level}"؟`;

  return `${persona}
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
${execution ? `${buildExecutionBlock(execution)}\n` : ''}
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
9. إن كان التسليم فارغاً أو غير متعلق بالتحدي، أعطِ score منخفضة ووجّه الطالب بلطف بدل اختلاق إيجابيات.${
    execution ? `\n${executionRules(execution)}` : ''
  }`;
}

/** Overrides for an executed submission: facts first, and no ready-made fix when it failed. */
function executionRules(execution: CodeExecutionReport): string {
  const shared = `قواعد التنفيذ الفعلي (تتقدم على كل ما سبق):
- لا تدّعِ خطأً نحوياً أو تشغيلياً لم يظهر في نتائج التنفيذ، ولا تنكر خطأً ظهر فيها.`;
  if (execution.executionSuccess) {
    return `${shared}
- الكود يعمل وكل الأمثلة المنفذة نجحت: قيّم تغطية المتطلبات والحالات الحدية وجودة الكود فقط.`;
  }
  return `${shared}
- executionSuccess = false: دورك الوحيد بطة مطاط سقراطية. score أقل من 60 و mastery = "needs-work".
- flaws: صف الخطأ الفعلي أو عدم تطابق المخرج كما ظهر بالضبط (السطر ونوع الخطأ)، بدون كتابة الإصلاح.
- verdict: اختمه بسؤال سقراطي واحد يقود الطالب لاكتشاف السبب بنفسه.
- improvedCode: اتركه فارغاً "" — يُمنع إعطاء الحل المباشر.`;
}

/**
 * Builds the strict-judge prompt for a Custom Lab Assignment (مسألة من الملزمة / كود مخصص).
 * I/O values are JSON-encoded so trailing spaces and newlines stay visible to the judge.
 */
export function buildCustomLabEvaluationPrompt({ taskPrompt, language, testCases, constraints, studentCode, scopeBlock = '' }: {
  taskPrompt: string;
  language: string;
  testCases: CustomLabTestCase[];
  constraints: string;
  studentCode: string;
  /** Course isolation rules from buildLabScopeBlock ('' outside a course). */
  scopeBlock?: string;
}): string {
  const persona = withScope(scopeBlock);
  const testCasesFormatted = testCases
    .map((tc, i) => `حالة اختبار ${i + 1} (testIndex=${i}):
  المدخلات: ${tc.input ? JSON.stringify(tc.input) : '(بدون مدخلات)'}
  المخرج المتوقع: ${JSON.stringify(tc.expectedOutput)}`)
    .join('\n\n');

  return `${persona}
أنت الآن "الحكم الآلي الصارم" (Strict Automated Judge) لمسألة من الملزمة أو مسألة مخصصة أدخلها الطالب.
لغة البرمجة: "${language}".

نص السؤال والمطلوب برمجياً:
"""
${taskPrompt}
"""

حالات الاختبار (القيم مُرمّزة بصيغة JSON، فكل مسافة أو \n فيها مقصودة وجزء من المخرج):
${testCasesFormatted}

${constraints ? `قيود وشروط خاصة:\n"""\n${constraints}\n"""\n` : ''}
كود الطالب المسلَّم:
"""
${studentCode}
"""

قواعد التحكيم:
1. نفّذ الكود ذهنياً (dry-run) سطراً بسطر لكل حالة اختبار، وحدد المخرج الفعلي الحرفي الذي يطبعه أو يُرجعه.
2. المطابقة حرفية: أي فرق في المسافات أو الأسطر الجديدة أو الأنواع ("3" مقابل "3.0"، True مقابل true، None بدل الطباعة) يعني passed=false.
3. إن انهار الكود أو لم يُترجم، اجعل actualOutput = "خطأ: <نوع الخطأ باختصار>".
4. إن فشلت أي حالة: rootCauseAnalysis تحدد السطر أو التعبير الذي انحرف فيه المنطق وسبب الانحراف، بدون إعادة كتابة الحل.
5. إن وُجدت قيود خاصة: اذكر في constraintNotes لكل قيد هل تحقق أم لا ولماذا، وإلا اتركها فارغة.

أسلوب الرد (تحت 50 كلمة لكل حقل نصي):
- hint: عند الفشل، تلميح مشجع بلهجة سعودية عصرية يسمّي الخطأ بدقة (مثال: "الاوتبت طلع معك مسافة زايدة" أو "الفانكشن ترجع None بدال ما تطبع"). عند النجاح، تهنئة قصيرة.
- edgeCaseChallenge: عند نجاح كل الحالات فقط، حالة حدية واحدة محددة يجربها الطالب بنفسه؛ وإلا اتركها فارغة.

أعد JSON فقط، مع عنصر واحد في testResults لكل حالة اختبار وبنفس ترتيبها:
{
  "testResults": [{ "testIndex": 0, "input": "...", "expectedOutput": "...", "actualOutput": "...", "passed": true }],
  "allPassed": true,
  "rootCauseAnalysis": "",
  "constraintNotes": [],
  "hint": "...",
  "edgeCaseChallenge": ""
}`;
}

/**
 * Feedback-only prompt for a Custom Lab run that was actually executed. Pass/fail is already
 * decided (see judgeTestRuns); the model explains it and never re-judges the table.
 */
export function buildCustomLabFeedbackPrompt({ taskPrompt, language, testResults, constraints, studentCode, scopeBlock = '' }: {
  taskPrompt: string;
  language: string;
  testResults: CustomLabTestResult[];
  constraints: string;
  studentCode: string;
  /** Course isolation rules from buildLabScopeBlock ('' outside a course). */
  scopeBlock?: string;
}): string {
  const persona = withScope(scopeBlock);
  const allPassed = testResults.every((r) => r.passed);
  const table = testResults
    .map(
      (r) =>
        `حالة ${r.testIndex + 1}: المدخلات ${JSON.stringify(r.input)} • المتوقع ${JSON.stringify(r.expectedOutput)} • الفعلي ${JSON.stringify(r.actualOutput)} • ${r.passed ? 'نجحت ✅' : 'فشلت ❌'}`
    )
    .join('\n');

  return `${persona}
أنت الآن تشرح نتائج تنفيذ حقيقي لمسألة من الملزمة أو مسألة مخصصة أدخلها الطالب.
لغة البرمجة: "${language}".

${DETERMINISTIC_EVALUATION_MANDATE}
executionSuccess: ${allPassed}

نص السؤال والمطلوب برمجياً:
"""
${taskPrompt}
"""

نتائج التنفيذ الفعلي (القيم بصيغة JSON، والحكم نهائي — لا تعِد تقييم أي حالة):
${table}

${constraints ? `قيود وشروط خاصة:\n"""\n${constraints}\n"""\n` : ''}
كود الطالب المسلَّم:
"""
${studentCode}
"""

المطلوب (تحت 50 كلمة لكل حقل نصي):
- rootCauseAnalysis: ${allPassed ? 'اتركه فارغاً.' : 'حدد السطر أو التعبير الذي أدى إلى الخطأ الفعلي أو عدم التطابق وسببه، بدون إعادة كتابة الحل.'}
- hint: ${allPassed ? 'تهنئة قصيرة بلهجة سعودية عصرية.' : 'سؤال أو تلميح سقراطي بلهجة سعودية عصرية يقود الطالب للإصلاح بنفسه (مثال: "قارن الاوتبت حرفاً حرفاً، وش الزايد عندك؟")، بدون الحل المباشر.'}
- constraintNotes: لكل قيد خاص هل تحقق في الكود أم لا ولماذا، وإلا اتركها فارغة.
- edgeCaseChallenge: ${allPassed ? 'حالة حدية واحدة محددة يجربها الطالب بنفسه.' : 'اتركه فارغاً.'}

أعد JSON فقط: { "rootCauseAnalysis": "", "hint": "", "constraintNotes": [], "edgeCaseChallenge": "" }`;
}
