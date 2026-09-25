import { MATH_ENGINE_DIRECTIVES } from '../stem';

/** Grades the Socratic answer and produces the follow-up transfer challenge. */
export function buildSocraticEvalPrompt({ concept, initialExplanation, socraticQuestion, socraticAnswer, isStem }: {
  concept: any;
  initialExplanation?: string;
  socraticQuestion?: string;
  socraticAnswer?: string;
  isStem?: boolean;
}): string {
  const transferRules = isStem
    ? `${MATH_ENGINE_DIRECTIVES}

تحدي التحويل transferChallenge يلتزم بالنمط B (الشرح الصوتي للخطوة الأولى) حصراً:
- scenario: جملة عربية قصيرة، ثم المصفوفة أو المسألة العددية في كتلة معزولة، مثال:
  "لدينا الآن المصفوفة B:

  $$B = \\begin{bmatrix} 2 & 5 \\\\ 1 & 4 \\end{bmatrix}$$

  ونريد حساب المعكوس $$B^{-1}$$."
- task: "بدون ما تحسب الناتج النهائي، اشرح لي بصوتك: إيش أول خطوة عددية راح تبدأ فيها وليه؟"
- hints: تلميحات عددية قصيرة، وأي صيغة فيها تُكتب داخل $$ ... $$.`
    : `تحدي التحويل transferChallenge يجب أن يكون سيناريو تطبيقياً محسوساً من المادة (لا تعريفاً نظرياً)، وأي صيغة كمية تُعرض في كتلة معزولة $$ ... $$ محاطة بسطر فارغ قبلها وبعدها.`;

  const prompt = `أنت "كواكلي" (Quakly)، المعلم الذكي والمدرب التفاعلي.
المفهوم: "${concept?.name || 'مفهوم رياضي'}"
السؤال المطروح: "${socraticQuestion}"
إجابة وشرح الطالب الصوتي/المكتوب: "${socraticAnswer}"
سياق الشرح الأولي: "${initialExplanation}"

قواعد التقييم الصارمة (PEDAGOGICAL CONSTRAINTS):
1. هل حدد الطالب الخطأ الحسابي/المنطقي بدقة؟
2. هل تعليله الصوتي سليم رياضياً؟
3. الرد duckReaction: قصير، مشجع، بلهجة عربية عصرية وذكية، بدون مقدمات إنشائية مطولة.
4. ${transferRules}`;

  return prompt;
}
