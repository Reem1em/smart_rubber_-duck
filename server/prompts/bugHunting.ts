import { MATH_ENGINE_DIRECTIVES } from '../stem';

/** Math bug-hunting challenge for math topics, code bug-hunting otherwise. */
export function buildBugChallengePrompt({ isMath, lang, diff }: { isMath: boolean; lang: string; diff: string }): string {
  const prompt = isMath
        ? `أنت "كواكلي" (Quakly)، محرك الرياضيات (Math Engine) والمدرب التفاعلي في نمط (صيد الخطأ الحسابي - Math Bug-Hunting).
ولّد تحدياً رياضياً عددياً واحداً في مجال: "${lang}" بمستوى: "${diff}".

${MATH_ENGINE_DIRECTIVES}

إلزامي في هذا المسار: استخدم النمط A (صيد الخطأ الحسابي) حصراً، وبخطأ واحد فقط (totalBugsCount = 1).

JSON Schema:
{
  "type": "debugging_challenge",
  "challenge": {
    "title": "صيد الخطأ الحسابي: محدد مصفوفة 2×2",
    "language": "${lang}",
    "difficulty": "${diff}",
    "expectedBehavior": "المطلوب حساب محدد المصفوفة بطرح حاصل ضرب القطر الثانوي من حاصل ضرب القطر الرئيسي.",
    "buggyCode": "المصفوفة A:\\n\\n$$A = \\\\begin{bmatrix} 1 & 4 \\\\\\\\ 2 & 3 \\\\end{bmatrix}$$\\n\\nخطوة كواكلي:\\n\\n$$\\\\det(A) = (1 \\\\times 3) + (4 \\\\times 2) = 11$$\\n\\nوين الغلطة في خطوتي؟ اشرح لي بصوتك إيش الخطوة الصح وليه.",
    "totalBugsCount": 1
  }
}`
        : `You are a Bug Hunting Challenge Engine for Computer Science students.
Generate 1 bug hunting challenge in language "${lang}" at difficulty level "${diff}".
Insert 2 to 4 intentional bugs across categories: Syntax, Logical flaws, Unhandled edge cases, Performance bottlenecks, Memory leaks, or Off-by-one errors.

CRITICAL INSTRUCTION: Clearly describe the expected behavior of the code WITHOUT pointing out where the errors are located or giving away specific flaws.

Return raw JSON strictly matching this schema:
{
  "type": "debugging_challenge",
  "challenge": {
    "title": "Challenge Title",
    "language": "${lang}",
    "difficulty": "${diff}",
    "expectedBehavior": "Detailed explanation of what the program is intended to do.",
    "buggyCode": "// Code containing hidden bugs\\n...",
    "totalBugsCount": 3
  }
}`;

  return prompt;
}

/** Grades the description of the bugs the student claims to have found. */
export function buildBugEvaluationPrompt({ buggyCode, userFixDescription, expectedBehavior, isMath }: {
  buggyCode?: string;
  userFixDescription?: string;
  expectedBehavior?: string;
  isMath?: boolean;
}): string {
  const prompt = `أنت "كواكلي" (Quakly)، مراجع الأخطاء الحسابية والبرمجية.
المسألة أو الكود الذي به أخطاء:
${buggyCode}

السلوك المتوقع:
${expectedBehavior}

شرح الطالب للأخطاء والتصحيح:
${userFixDescription}

المهمة:
قيّم بدقة هل اكتشف الطالب الخطأ الحسابي أو المنطقي بشكل صحيح.
قدم تقييماً مشجعاً ومباشراً باللغة العربية الفصحى بدون مقدمات طويلة.
${isMath ? `
${MATH_ENGINE_DIRECTIVES}

حقل correctedCode يجب أن يعرض الحل الصحيح في كتل $$ ... $$ معزولة بدون أي رسم نصي للمصفوفات.
` : ''}
JSON Schema:
{
  "score": 85,
  "summary": "تقييم أداء الطالب في كشف الخطأ الحسابي أو المنطقي",
  "identifiedBugs": ["قائمة الأخطاء التي اكتشفها الطالب بشكل صحيح"],
  "missedBugs": ["قائمة الأخطاء التي غفل عنها"],
  "correctedCode": "الحل الحسابي أو الكود المصحح النظيف"
}`;

  return prompt;
}
