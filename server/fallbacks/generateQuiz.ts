import { isStemTopic } from '../stem';

/** Static payload served when every model in the chain fails. */
export function quizFallback(body: any) {
  const conceptName = body?.concept?.name || 'المفهوم المدروس';
  const conceptSummary = body?.concept?.summary || '';
  const keyPrinciples: string[] = Array.isArray(body?.concept?.keyPrinciples) ? body.concept.keyPrinciples : [];
  const p1 = keyPrinciples[0] || 'المبادئ والأسس العلمية للمفهوم';
  const p2 = keyPrinciples[1] || 'التطبيق العملي السليم للخصائص';
  const p3 = keyPrinciples[2] || 'تحليل الحالات والمعطيات المرتبطة';

  if (isStemTopic(conceptName, conceptSummary, keyPrinciples)) {
    return {
      questions: [
        {
          id: 1,
          question: `احسب محدد المصفوفة A:

$$A = \\begin{bmatrix} 1 & 4 \\\\ 2 & 3 \\end{bmatrix}$$

ما هي القيمة العددية لـ $\\det(A)$؟`,
          options: [
            '-5',
            '11',
            '5',
            '-11',
          ],
          correctAnswerIndex: 0,
          explanation: `محدد المصفوفة 2×2 هو حاصل ضرب القطر الرئيسي ناقص حاصل ضرب القطر الثانوي:

$$\\det(A) = (1 \\times 3) - (4 \\times 2) = 3 - 8 = -5$$`,
          difficulty: 'بسيط',
        },
        {
          id: 2,
          question: `احسب العنصر الواقع في الصف الأول والعمود الأول من حاصل الضرب $A \\times B$:

$$A = \\begin{bmatrix} 1 & 2 \\\\ 0 & 3 \\end{bmatrix}, \\quad B = \\begin{bmatrix} 5 & 9 \\\\ 1 & 4 \\end{bmatrix}$$`,
          options: [
            '7',
            '14',
            '5',
            '11',
          ],
          correctAnswerIndex: 0,
          explanation: `العنصر (1,1) هو ضرب الصف الأول من A في العمود الأول من B:

$$(1 \\times 5) + (2 \\times 1) = 5 + 2 = 7$$`,
          difficulty: 'بسيط',
        },
        {
          id: 3,
          question: `احسب مشتقة الدالة:

$$f(x) = x^{3} + 4x^{2} - 5x + 7$$`,
          options: [
            "$f'(x) = 3x^{2} + 8x - 5$",
            "$f'(x) = x^{2} + 8x - 5$",
            "$f'(x) = 3x^{2} + 4x - 5$",
            "$f'(x) = 3x^{2} + 8x$",
          ],
          correctAnswerIndex: 0,
          explanation: `بتطبيق قاعدة القوى حداً بحد:

$$f'(x) = 3x^{2} + 8x - 5$$

ومشتقة الثابت 7 تساوي صفراً.`,
          difficulty: 'متوسط',
        },
        {
          id: 4,
          question: `احسب ناتج التكامل غير المحدد:

$$\\int (2x + 1)\\,dx$$`,
          options: [
            '$x^{2} + x + C$',
            '$2x^{2} + x + C$',
            '$x^{2} + C$',
            '$2x + C$',
          ],
          correctAnswerIndex: 0,
          explanation: `بتطبيق قاعدة رفع الأس:

$$\\int (2x + 1)\\,dx = x^{2} + x + C$$`,
          difficulty: 'متوسط',
        },
        {
          id: 5,
          question: `احسب الضرب القياسي للمتجهين:

$$\\vec{u} = \\langle 1, 2 \\rangle, \\quad \\vec{v} = \\langle 3, -1 \\rangle$$`,
          options: [
            '1',
            '5',
            '7',
            '-1',
          ],
          correctAnswerIndex: 0,
          explanation: `بضرب المركبات المتناظرة ثم جمعها:

$$\\vec{u} \\cdot \\vec{v} = (1 \\times 3) + (2 \\times -1) = 3 - 2 = 1$$`,
          difficulty: 'متقدم',
        },
      ],
    };
  }

  return {
    questions: [
      {
        id: 1,
        question: `ما هو التعريف والهدف الأساسي لمفهوم (${conceptName})؟`,
        options: [
          conceptSummary ? `يرتكز على: ${conceptSummary}` : `فهم وتطبيق ${conceptName} وفق المعايير والقواعد العلمية الصحيحة`,
          'تجاهل القواعد الأساسية والاعتماد على الحفظ الصم دون تطبيق',
          'استخدام إجراءات غير مرتبطة بسياق المادة الدراسية',
          'إلغاء المعايير المعتمدة في معالجة عناصر المفهوم',
        ],
        correctAnswerIndex: 0,
        explanation: `المفهوم (${conceptName}) يهدف أساساً إلى: ${conceptSummary || 'تطبيق القواعد العلمية الصحيحة المقررة في المادة'}.`,
        difficulty: 'بسيط',
      },
      {
        id: 2,
        question: `أي من العناصر التالية يُعد ركيزة أساسية عند دراسة (${conceptName})؟`,
        options: [
          p1,
          'تجاهل الشروط والضوابط الأساسية المحددة في المادة',
          'الاعتماد على التخمين العشوائي بدلاً من المنطق والتحليل',
          'إهمال التأثيرات المباشرة على النتائج والعمليات',
        ],
        correctAnswerIndex: 0,
        explanation: `من الركائز الأساسية لـ (${conceptName}) هو (${p1}) لضمان صحة التطبيق والفهم.`,
        difficulty: 'بسيط',
      },
      {
        id: 3,
        question: `كيف يؤثر تطبيق (${p2}) على تحقيق أهداف (${conceptName})؟`,
        options: [
          `يضمن دقة النتائج وسلامة البناء المنطقي للمفهوم (${conceptName})`,
          'يؤدي إلى تعارض منطقي وصعوبة في متابعة الخطوات',
          'يلغي الحاجة إلى مراجعة المبادئ الأساسية في المادة',
          'يحد من كفاءة الحل ويقلل من دقة التطبيق',
        ],
        correctAnswerIndex: 0,
        explanation: `تطبيق (${p2}) يمثل حلقة وصل جوهرية لتأكيد صحة المخرجات وترسيخ فهم (${conceptName}).`,
        difficulty: 'متوسط',
      },
      {
        id: 4,
        question: `عند التعامل مع الحالات المتقدمة لـ (${conceptName})، ما الذي يتطلبه (${p3})؟`,
        options: [
          `تحليل الشروط بدقة والربط المتكامل بين مبادئ المفهوم (${keyPrinciples.slice(0, 2).join(' و ') || conceptName})`,
          'الاكتفاء بالنظرة السطحية دون دراسة الترابط بين العناصر',
          'استخدام حلول عشوائية دون الاستناد إلى القواعد المنهجية',
          'عزل المفهوم تماماً عن باقي موضوعات المادة المقررة',
        ],
        correctAnswerIndex: 0,
        explanation: `المستوى المتقدم لمفهوم (${conceptName}) يتطلب فهماً شمولياً يربط بين المبادئ وحالات التطبيق المختلفة.`,
        difficulty: 'متقدم',
      },
      {
        id: 5,
        question: `ما النتيجة المتوقعة عند إغفال المبادئ الجوهرية لمفهوم (${conceptName}) أثناء التطبيق؟`,
        options: [
          'حدوث أخطاء في الاستنتاج وعدم توافق المخرجات مع القواعد العلمية',
          'الحصول على نتائج أكثر دقة وسرعة دائماً',
          'تلقائية اكتمال العمل دون أي مراجعة أو تصحيح',
          'عدم حدوث أي تأثير على الإطلاق على صحة العمل',
        ],
        correctAnswerIndex: 0,
        explanation: `إغفال مبادئ (${conceptName}) يؤدي حتماً إلى خلل في المخرجات وعدم دقة التحليل العلمي.`,
        difficulty: 'متقدم',
      },
    ],
  };
}
