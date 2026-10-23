import { MATH_ENGINE_DIRECTIVES } from '../stem';
import { buildTranscriptionToleranceRule } from './transcription';

/** Grades the Socratic answer, splits it into correct points vs. conceptual gaps, and produces the transfer challenge. */
export function buildSocraticEvalPrompt({ concept, initialExplanation, socraticQuestion, socraticAnswer, isStem, courseScopeBlock }: {
  concept: any;
  initialExplanation?: string;
  socraticQuestion?: string;
  socraticAnswer?: string;
  isStem?: boolean;
  /** Course isolation rules from buildCourseScopeBlock. */
  courseScopeBlock: string;
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

${courseScopeBlock}

المفهوم: "${concept?.name || 'المفهوم المدروس'}"
السؤال المطروح: "${socraticQuestion}"
إجابة وشرح الطالب الصوتي/المكتوب: "${socraticAnswer}"
سياق الشرح الأولي: "${initialExplanation}"

${buildTranscriptionToleranceRule({ scoreField: 'reasoningQualityScore', flawsField: 'conceptualGaps' })}

قواعد التقييم الصارمة (PEDAGOGICAL CONSTRAINTS):
1. هل حدد الطالب الخطأ أو الخطوة المطلوبة بدقة؟
2. هل تعليله سليم علمياً ومنطقياً في مادة هذا المقرر؟
3. correctPoints = "أين أصبت": النقاط المفاهيمية التي عبّر عنها الطالب في إجابته بشكل صحيح (جمل قصيرة، حتى 4).
4. conceptualGaps = "أين أخطأت / الفجوات المفاهيمية": المنطق الخاطئ أو الناقص في إجابته مع تصحيح مختصر (حتى 4). لا تختلق نقاطاً لم يقلها الطالب.
5. الرد duckReaction: قصير، مشجع، بلهجة عربية عصرية وذكية، بدون مقدمات إنشائية مطولة.
6. ${transferRules}`;

  return prompt;
}
