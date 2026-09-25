/**
 * Syllabus parsing prompts for "خريطة المقرر" (Course Roadmap), Mode A.
 *
 * The model reads an official university course specification (توصيف المادة) and
 * returns the chronological academic schedule, the milestones and their grade
 * weights. It never invents dates or weights that the document does not state.
 */

export const COURSE_ROADMAP_SYSTEM_INSTRUCTION = `أنت "كواكلي" (Quakly)، محلل التوصيفات الأكاديمية في منصة كواكلي.
مهمتك: تحويل توصيف المادة الجامعي إلى خريطة زمنية دقيقة أسبوعاً بأسبوع.

قواعد صارمة:
1. لا تخترع أي معلومة غير موجودة في المستند. إذا لم يذكر التوصيف تاريخاً أو وزناً، اترك الحقل فارغاً أو صفراً.
2. استخرج الجدول الزمني كما هو مرتب في المستند: الأسبوع الأول حتى الأسبوع الأخير بالتسلسل وبدون فجوات.
3. التواريخ بصيغة YYYY-MM-DD فقط.
4. الأسماء والعناوين بالعربية كما وردت، والمصطلحات التقنية تُترك بالإنجليزية إن كانت كذلك في المستند.
5. أعد JSON فقط بدون أي نص خارجه وبدون حشو حواري.`;

export interface SyllabusPromptInput {
  /** Concept names already extracted from the course material, for id alignment. */
  conceptNames: string[];
  /** Today's date (YYYY-MM-DD) so a term with no stated start can be anchored. */
  todayIso: string;
  courseName?: string;
}

function extractionRules({ conceptNames, todayIso, courseName }: SyllabusPromptInput): string {
  const known = conceptNames.slice(0, 60);

  return `اليوم هو ${todayIso}.${courseName ? `\nاسم المادة في مساحة الطالب: "${courseName}".` : ''}

استخرج من توصيف المادة المرفق:
1. weeks: الجدول الأكاديمي الزمني بالترتيب (الأسبوع 1 حتى الأسبوع N). لكل أسبوع:
   - weekNumber: رقم الأسبوع كما في التوصيف.
   - title: عنوان الوحدة أو الموضوع المقرر في ذلك الأسبوع.
   - concepts: قائمة المفاهيم أو الموضوعات الفرعية المقررة في الأسبوع (من 1 إلى 5).
   - isReviewWeek: true فقط إذا كان الأسبوع مخصصاً للمراجعة أو التثبيت بدون مادة جديدة.
   - highYield: true إذا نص التوصيف على أن هذا الأسبوع محوري أو مرتبط بوزن درجات كبير.
2. milestones: محطات التقييم (اختبار نصفي، نهائي، كويز، مشروع). لكل محطة:
   - title: مسماها كما في التوصيف.
   - kind: midterm أو final أو quiz أو project.
   - weekNumber: الأسبوع الذي تقع فيه.
   - date: تاريخها بصيغة YYYY-MM-DD إن ذُكر صراحة، وإلا اتركه فارغاً.
   - gradeWeight: نسبتها من الدرجة النهائية كرقم من 0 إلى 100، أو 0 إن لم تُذكر.
   - coversWeeks: أرقام الأسابيع التي تغطيها المحطة (مثال: الميد الأول في الأسبوع 5 يغطي [1,2,3,4]).
3. startDate: تاريخ بداية الأسبوع الأول بصيغة YYYY-MM-DD إن ذُكر في التوصيف، وإلا استخدم ${todayIso}.
4. totalWeeks: عدد أسابيع المقرر.
5. duckNote: سطر واحد بلهجة سعودية عصرية مشجعة (تحت 25 كلمة) يلخص شكل المشوار للطالب.
${
  known.length > 0
    ? `\nالمفاهيم المستخرجة مسبقاً من مادة الطالب — استخدم صياغتها الحرفية كلما طابقت موضوع الأسبوع لتتطابق الخريطة مع مساحته:\n${known
        .map((name) => `- ${name}`)
        .join('\n')}`
    : ''
}`;
}

/** Instruction block appended after an attached PDF/image syllabus. */
export function buildSyllabusDocumentPrompt(input: SyllabusPromptInput): string {
  return `المستند المرفق هو توصيف مادة جامعية. اقرأه بالكامل من أول صفحة حتى آخرها.

${extractionRules(input)}`;
}

/** Same extraction, for a syllabus supplied as plain text. */
export function buildSyllabusTextPrompt(input: SyllabusPromptInput, syllabusText: string): string {
  return `نص توصيف المادة:
"""
${syllabusText.slice(0, 40000)}
"""

${extractionRules(input)}`;
}
