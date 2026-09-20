/** Math bug-hunting challenge for math topics, code bug-hunting otherwise. */
export function buildBugChallengePrompt({ isMath, lang, diff }: { isMath: boolean; lang: string; diff: string }): string {
  const prompt = isMath
        ? `أنت "كواكلي" (Quakly)، خبير الرياضيات والمدرب التفاعلي في نمط (صيد الخطأ الحسابي - Math Bug-Hunting).
المطلوب توليد تحدي رياضي لصيد خطأ حسابي في مجال: "${lang}" بمستوى: "${diff}".

قاعدة صارمة لعزل الصيغ والأسطر (Zero In-line Math Rule):
1. يُمنع منعاً باتاً دمج المصفوفات أو المعادلات الطويلة داخل الأسطر النصية باللغة العربية (تجنب قلب الحروف والأرقام RTL/LTR).
2. أي مصفوفة أو عملية حسابية يجب أن تُكتب في سطر مستقل كلياً مع ترك سطر فارغ قبلها وبعدها.
3. التنسيق الإلزامي للمصفوفات (عرض ثنائي الأبعاد):
   - افصل كل مصفوفة برسم مستقل:
     المصفوفة A =
     [ 1   2 ]

     المصفوفة B =
     [ 5   9 ]

4. عند كتابة خطوات الحل الخاطئة للزميل، اكتب كل خطوة على سطر منفصل وبفراغات واسعة:
   خطوة الزميل:
   (1 × 5) + (2 × 9)

5. الرموز الرياضية الحقيقية: x² ، x³ ، f⁻¹(x) ، A⁻¹ ، ∫ ، dy/dx.
6. التحدي في نهاية buggyCode: "وين الغلطة الحسابية أو المنطقية في حله؟ اشرح لي بصوتك إيش الخطوة الصح."

JSON Schema:
{
  "type": "debugging_challenge",
  "challenge": {
    "title": "صيد الخطأ الحسابي: ضرب المصفوفات",
    "language": "${lang}",
    "difficulty": "${diff}",
    "expectedBehavior": "المطلوب شرح ضرب الصف في العمود والخطوة الحسابية الصحيحة.",
    "buggyCode": "السؤال:\\nلدينا المصفوفتان:\\nالمصفوفة A =\\n[ 1   2 ]\\n\\nالمصفوفة B =\\n[ 5   9 ]\\n\\nإذا قام الزميل بحساب ضرب A × B كالتالي:\\n[ (1 × 5) + (2 × ?) ]\\n\\nوين الغلطة الحسابية أو المنطقية في حله؟ اشرح لي بصوتك إيش الخطوة الصح.",
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
export function buildBugEvaluationPrompt({ buggyCode, userFixDescription, expectedBehavior }: {
  buggyCode?: string;
  userFixDescription?: string;
  expectedBehavior?: string;
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
