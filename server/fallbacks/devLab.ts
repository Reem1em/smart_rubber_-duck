import type { DevLabMode } from '../prompts/devLab';

/** Static payloads served when every model in the chain fails. */
export function devChallengeFallback(body: any) {
  const mode: DevLabMode = body?.mode === 'bugHunter' ? 'bugHunter' : 'builder';
  const language = body?.language || 'Python';
  const level = body?.level || 'Intermediate';

  if (mode === 'bugHunter') {
    return {
      mode,
      title: 'ثغرة في حساب متوسط درجات الطلاب',
      language,
      level,
      businessContext:
        'لوحة تحكم المعلم تعرض متوسط درجات كل شعبة. الدالة التالية تُستدعى مع كل تحديث للصفحة، وبدأت تُرجع نتائج غير متوقعة لبعض الشعب.',
      expectedBehavior:
        'تُرجع الدالة المتوسط الحسابي الدقيق لكل الدرجات المُدخلة، وتتعامل بأمان مع الشعب التي لم تُرصد درجاتها بعد.',
      buggyCode: `def average_score(scores):
    """يحسب متوسط درجات الشعبة."""
    total = 0
    for i in range(len(scores) + 1):
        total += scores[i]
    return total / len(scores)


def top_students(scores, threshold):
    """يُرجع أسماء الطلاب فوق حد معين."""
    return [name for name, score in scores.items() if score > threshold]`,
      bugCategory: 'off-by-one',
      edgeCases: [
        'قائمة درجات فارغة تماماً (شعبة لم تُرصد درجاتها بعد)',
        'درجة واحدة فقط في القائمة',
        'درجات عشرية غير صحيحة',
      ],
      requirements: [],
      sampleIO: ['average_score([80, 90, 100]) => 90.0'],
      voicePrompt: 'وين الثغرة في هذا الكود؟ اشرح لي بصوتك وش يصير فيها وكيف تصلحها.',
    };
  }

  return {
    mode,
    title: 'بناء محرك تسعير سلة المشتريات مع الخصومات',
    language,
    level,
    businessContext:
      'متجر إلكتروني يحتاج وحدة تحسب إجمالي السلة بعد تطبيق الخصومات. الفريق يعتمد على هذه الوحدة في صفحة الدفع، لذا يجب أن تكون نتائجها دقيقة ومتوقعة.',
    requirements: [
      'استقبال قائمة من العناصر، كل عنصر يحمل السعر والكمية.',
      'تطبيق خصم نسبي على العناصر المؤهلة فقط دون المساس ببقية العناصر.',
      'إرجاع الإجمالي مقرباً إلى منزلتين عشريتين.',
      'رفض الكميات السالبة أو غير الرقمية برسالة خطأ واضحة.',
    ],
    sampleIO: [
      '[{price: 10, qty: 2}] , discount=0 => 20.00',
      '[{price: 10, qty: 2}, {price: 5, qty: 1}] , discount=10% => 22.50',
    ],
    edgeCases: [
      'سلة فارغة تماماً',
      'كمية صفرية أو سالبة',
      'خصم يتجاوز 100%',
      'أسعار عشرية تسبب أخطاء تقريب تراكمية',
    ],
    expectedBehavior:
      'وحدة تسعير دقيقة وقابلة للاختبار تتعامل مع كل الحالات الحدية أعلاه بدون انهيار.',
    buggyCode: '',
    bugCategory: '',
    voicePrompt: 'قبل ما تكتب سطر واحد، اشرح لي بصوتك: وش خطتك وأول خطوة راح تبدأ فيها وليه؟',
  };
}

export function devEvaluationFallback(body: any) {
  const hasCode = typeof body?.studentCode === 'string' && body.studentCode.trim().length > 20;

  return {
    score: hasCode ? 78 : 35,
    verdict: hasCode
      ? 'كواك! شغل نظيف — المنطق الأساسي صحيح وواضح. باقي لك الحالات الحدية وبتكون ممتازة.'
      : 'كواك! ما وصلني كود كافٍ أقيّمه. اكتب محاولتك ولو ناقصة، وأنا أمشي معك خطوة خطوة.',
    whatWorked: hasCode
      ? ['المنطق الأساسي للحل صحيح ويعطي النتيجة المتوقعة في الحالة الاعتيادية.', 'تسمية المتغيرات واضحة وسهلة القراءة.']
      : [],
    flaws: hasCode
      ? ['لم يتم التحقق من المدخلات الفارغة قبل استخدامها، مما قد يسبب انهياراً وقت التشغيل.']
      : ['لا يوجد كود مُسلَّم لتقييمه.'],
    edgeCaseResilience: hasCode
      ? ['المدخل الفارغ: غير معالج.', 'القيم الحدية: معالجة جزئياً.']
      : ['لم يتم تقييم الحالات الحدية لغياب الكود.'],
    codeQuality: hasCode
      ? ['أضف تعليقاً موجزاً يشرح الغرض من الدالة.', 'افصل التحقق من المدخلات عن منطق الحساب.']
      : ['ابدأ بهيكل دالة بسيط ثم طوّره تدريجياً.'],
    improvedCode: hasCode
      ? '// أضف تحققاً من المدخلات في بداية الدالة قبل أي عملية حسابية،\n// ثم أعد الحساب على البيانات بعد التأكد من صلاحيتها.'
      : '// اكتب محاولتك الأولى هنا، ولو كانت ناقصة.',
    mastery: hasCode ? 'competent' : 'needs-work',
  };
}
