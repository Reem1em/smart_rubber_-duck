import { MATH_ENGINE_DIRECTIVES } from '../stem';

/** Diagnosis prompt: scores the explanation and asks a single Socratic question. */
export function buildDiagnosePrompt({ concept, studentExplanation, confidenceLevel, materialContext, isStem }: {
  concept: any;
  studentExplanation: string;
  confidenceLevel: number;
  materialContext?: string;
  isStem?: boolean;
}): string {
  const mathEngineBlock = isStem
    ? `تم تفعيل محرك الرياضيات (MATH ENGINE ACTIVATED) لهذا المقرر.

${MATH_ENGINE_DIRECTIVES}

مثال إلزامي لصياغة socraticQuestion بالنمط A:
"المصفوفة A:

$$A = \\begin{bmatrix} 1 & 4 \\\\ 2 & 3 \\end{bmatrix}$$

خطوة كواكلي:

$$\\det(A) = (1 \\times 3) + (4 \\times 2) = 11$$

وين الغلطة في خطوتي؟ اشرح لي بصوتك إيش الخطوة الصح وليه."

مثال إلزامي لصياغة socraticQuestion بالنمط B:
"المصفوفتان:

$$A = \\begin{bmatrix} 1 & 2 \\\\ 0 & 3 \\end{bmatrix}, \\quad B = \\begin{bmatrix} 5 & 9 \\\\ 1 & 4 \\end{bmatrix}$$

بدون ما تحسب الناتج، اشرح لي بصوتك: إيش أول خطوة عددية راح تبدأ فيها في حساب A × B وليه؟"`
    : `هذا المقرر غير رياضي: اطرح سؤالاً سقراطياً تطبيقياً واحداً مبنياً على سيناريو محسوس من المادة، لا على تعريف نظري مجرد.
- ZERO CONVERSATIONAL FILLER: لا تبدأ بـ "مرحباً" أو "اليوم سنتعلم".
- إن ورد أي رمز أو صيغة كمية، اعرضه في كتلة معزولة $$ ... $$ محاطة بسطر فارغ قبلها وبعدها.`;

  const prompt = `أنت "كواكلي" (Quakly)، المعلم الذكي والمدرب التفاعلي في منصة "كواكلي" لتطوير مهارات التفكير والشرح الذاتي للطلاب (جبر Algebra & Linear Algebra، تفاضل Differential Calculus، تكامل Integral Calculus، متجهات Vectors، وكافة المقررات الأخرى).
فلسفتك الأساسية هي تأثير التلميذ المعلم (Protégé Effect): الطلاب يتعلمون بعمق عندما يشرحون المنطق والآليات بصوتهم.

${mathEngineBlock}

المفهوم المستهدف: "${concept.name}"
ملخص المفهوم: "${concept.summary}"
المبادئ الرئيسية: ${JSON.stringify(concept.keyPrinciples)}
السياق من المادة: "${(materialContext || '').slice(0, 1000)}"
مستوى ثقة الطالب المعلن: ${confidenceLevel}%
شرح الطالب للمفهوم:
"${studentExplanation}"

مهمتك بصفتك كواكلي (Quakly):
1. تقييم مستوى الفهم الفعلي للطالب (understandingScore) من 0 إلى 100 بناءً على الدقة الرياضية والمنطقية.
2. مقارنة مستوى الثقة المعلن (${confidenceLevel}%) مع مستوى الفهم الفعلي:
   - الثقة > الفهم + 15: نوع الفجوة 'overconfident'
   - الثقة < الفهم - 15: نوع الفجوة 'underconfident'
   - خلاف ذلك: 'calibrated'
3. حساب gapScore = Math.abs(confidenceLevel - understandingScore).
4. كتابة gapDescription باللغة العربية (تحت 70 كلمة).
5. استخراج identifiedFlaws و strengths.
6. صياغة سؤال سقراطي واحد فقط (socraticQuestion) بالنمط A أو النمط B، ملتزماً التزاماً صارماً بقاعدة عزل LaTeX وحظر الحشو النظري، وتحت 50 كلمة من النص الوصفي.
7. تقديم تلميح سقراطي لطيف (socraticHint) يوجه للخطوة أو العنصر المعني بدون كشف الإجابة.`;

  return prompt;
}
