import { Type } from '@google/genai';

/** One schema serving both Code Lab modes; mode-specific fields stay empty when unused. */
export const devChallengeSchema = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING, enum: ['builder', 'bugHunter'] },
    title: { type: Type.STRING, description: 'عنوان التذكرة الهندسية أو تحدي صيد الثغرة' },
    language: { type: Type.STRING },
    level: { type: Type.STRING },
    businessContext: { type: Type.STRING, description: 'سياق العمل الواقعي في سطرين' },
    requirements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'المتطلبات الوظيفية الدقيقة (نمط البناء فقط)',
    },
    sampleIO: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'أمثلة مدخلات ومخرجات بصيغة input => output',
    },
    edgeCases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'قائمة الحالات الحدية التي يجب على الطالب مراعاتها',
    },
    expectedBehavior: { type: Type.STRING, description: 'السلوك الصحيح المطلوب بدون كشف موقع الخطأ' },
    buggyCode: { type: Type.STRING, description: 'الكود الحاوي على خطأ واحد فقط (نمط صياد الثغرات)' },
    bugCategory: {
      type: Type.STRING,
      description: 'off-by-one | unhandled-edge-case | type-coercion | resource-leak | فارغ في نمط البناء',
    },
    voicePrompt: { type: Type.STRING, description: 'مطالبة الشرح الصوتي (تأثير التلميذ المعلم)' },
  },
  required: ['mode', 'title', 'language', 'level', 'businessContext', 'edgeCases', 'voicePrompt'],
};

export const devEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: 'درجة التقييم من 0 إلى 100' },
    verdict: { type: Type.STRING, description: 'رد كواكلي القصير المشجع بلهجة سعودية عصرية' },
    whatWorked: { type: Type.ARRAY, items: { type: Type.STRING } },
    flaws: { type: Type.ARRAY, items: { type: Type.STRING } },
    edgeCaseResilience: { type: Type.ARRAY, items: { type: Type.STRING } },
    codeQuality: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvedCode: { type: Type.STRING, description: 'الكود المصحح بنفس لغة البرمجة' },
    mastery: { type: Type.STRING, enum: ['needs-work', 'competent', 'mastered'] },
  },
  required: ['score', 'verdict', 'whatWorked', 'flaws', 'edgeCaseResilience', 'codeQuality', 'improvedCode', 'mastery'],
};

export const customLabEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    testResults: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          testIndex: { type: Type.NUMBER, description: 'فهرس حالة الاختبار (يبدأ من 0)' },
          input: { type: Type.STRING, description: 'المدخلات المستخدمة' },
          expectedOutput: { type: Type.STRING, description: 'المخرج المتوقع' },
          actualOutput: { type: Type.STRING, description: 'المخرج الفعلي الذي ينتجه كود الطالب' },
          passed: { type: Type.BOOLEAN, description: 'هل تطابق المخرج الفعلي مع المتوقع' },
        },
        required: ['testIndex', 'input', 'expectedOutput', 'actualOutput', 'passed'],
      },
      description: 'نتائج كل حالة اختبار',
    },
    allPassed: { type: Type.BOOLEAN, description: 'هل نجحت جميع حالات الاختبار' },
    rootCauseAnalysis: { type: Type.STRING, description: 'تحليل جذر المشكلة إن وُجد خطأ' },
    constraintNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'ملاحظات حول القيود الخاصة',
    },
    hint: { type: Type.STRING, description: 'تلميح مشجع بلهجة كواكلي السعودية' },
    edgeCaseChallenge: { type: Type.STRING, description: 'تحدي حالة حدية إضافي عند النجاح' },
  },
  required: ['testResults', 'allPassed', 'rootCauseAnalysis', 'constraintNotes', 'hint', 'edgeCaseChallenge'],
};
