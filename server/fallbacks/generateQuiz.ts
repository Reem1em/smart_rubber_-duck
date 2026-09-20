/** Static payload served when every model in the chain fails. */
export function quizFallback(body: any) {
  const conceptName = body?.concept?.name || 'المفهوم المدروس';
  const conceptSummary = body?.concept?.summary || '';
  const keyPrinciples: string[] = Array.isArray(body?.concept?.keyPrinciples) ? body.concept.keyPrinciples : [];
  const p1 = keyPrinciples[0] || 'المبادئ والأسس العلمية للمفهوم';
  const p2 = keyPrinciples[1] || 'التطبيق العملي السليم للخصائص';
  const p3 = keyPrinciples[2] || 'تحليل الحالات والمعطيات المرتبطة';

  const isMath =
    conceptName.includes('مصفوف') ||
    conceptName.includes('جبر') ||
    conceptName.includes('تفاضل') ||
    conceptName.includes('تكامل') ||
    conceptName.includes('متجه') ||
    conceptName.includes('محدد') ||
    conceptName.includes('matrix') ||
    conceptName.includes('calculus') ||
    conceptName.includes('vector');

  if (isMath) {
    return {
      questions: [
        {
          id: 1,
          question: `لدينا المصفوفة A:
| 1   4 |
| 2   3 |
ما هي القيمة العددية لمحدد المصفوفة det(A)؟`,
          options: [
            '-5',
            '11',
            '5',
            '-11',
          ],
          correctAnswerIndex: 0,
          explanation: `محدد المصفوفة 2×2 يُحسب بضرب عناصر القطر الرئيسي وطرح حاصل ضرب عناصر القطر الآخر: det(A) = (1 × 3) - (4 × 2) = 3 - 8 = -5.`,
          difficulty: 'بسيط',
        },
        {
          id: 2,
          question: `ما هو الشرط الرياضي الأساسي لكي تكون المصفوفة المربعة A قابلة للعكس ولها معكوس A⁻¹؟`,
          options: [
            'أن يكون محدد المصفوفة det(A) ≠ 0',
            'أن تكون جميع عناصر المصفوفة موجبة',
            'أن يكون محدد المصفوفة det(A) = 0',
            'أن تكون رتبة المصفوفة فردية فقط',
          ],
          correctAnswerIndex: 0,
          explanation: `المصفوفة تمتلك معكوساً A⁻¹ وتكون غير شاذة (Invertible) إذا وفقط إذا كان محددها غير صفري det(A) ≠ 0.`,
          difficulty: 'بسيط',
        },
        {
          id: 3,
          question: `ما هي مشتقة الدالة f(x) = x³ + 4x² - 5x + 7؟`,
          options: [
            "f'(x) = 3x² + 8x - 5",
            "f'(x) = x² + 8x - 5",
            "f'(x) = 3x² + 4x - 5",
            "f'(x) = 3x² + 8x",
          ],
          correctAnswerIndex: 0,
          explanation: `بتطبيق قاعدة القوى في التفاضل: مشتقة x³ هي 3x²، ومشتقة 4x² هي 8x، ومشتقة -5x هي -5، ومشتقة الثابت 7 هي 0.`,
          difficulty: 'متوسط',
        },
        {
          id: 4,
          question: `ما هو ناتج التكامل غير المحدد التالي:
∫ (2x + 1) dx`,
          options: [
            'x² + x + C',
            '2x² + x + C',
            'x² + C',
            '2x + C',
          ],
          correctAnswerIndex: 0,
          explanation: `تكامل 2x بالنسبة لـ x هو 2(x²/2) = x²، وتكامل الثابت 1 هو x، مع إضافة ثابت التكامل C.`,
          difficulty: 'متوسط',
        },
        {
          id: 5,
          question: `إذا كان لدينا المتجهان u = ⟨1, 2⟩ و v = ⟨3, -1⟩، فما هو ناتج الضرب القياسي (الداخلي) u · v؟`,
          options: [
            '1',
            '5',
            '7',
            '-1',
          ],
          correctAnswerIndex: 0,
          explanation: `الضرب النقطي يُحسب بضرب المركبات المتناظرة ثم جمعها: u · v = (1 × 3) + (2 × -1) = 3 - 2 = 1.`,
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
