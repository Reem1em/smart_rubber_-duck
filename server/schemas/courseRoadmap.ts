import { Type } from '@google/genai';

/** Structured output of the syllabus parser feeding "خريطة المقرر". */
export const courseRoadmapSchema = {
  type: Type.OBJECT,
  properties: {
    courseName: { type: Type.STRING, description: 'اسم المقرر كما ورد في التوصيف' },
    startDate: { type: Type.STRING, description: 'تاريخ بداية الأسبوع الأول بصيغة YYYY-MM-DD' },
    totalWeeks: { type: Type.NUMBER, description: 'عدد أسابيع المقرر' },
    weeks: {
      type: Type.ARRAY,
      description: 'الجدول الأكاديمي الزمني مرتباً من الأسبوع الأول حتى الأخير',
      items: {
        type: Type.OBJECT,
        properties: {
          weekNumber: { type: Type.NUMBER },
          title: { type: Type.STRING, description: 'عنوان الوحدة المقررة في الأسبوع' },
          concepts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'المفاهيم المقررة في هذا الأسبوع',
          },
          highYield: { type: Type.BOOLEAN, description: 'أسبوع محوري بوزن درجات كبير' },
          isReviewWeek: { type: Type.BOOLEAN, description: 'أسبوع مراجعة بدون مادة جديدة' },
        },
        required: ['weekNumber', 'title', 'concepts'],
      },
    },
    milestones: {
      type: Type.ARRAY,
      description: 'محطات التقييم وأوزانها من الدرجة النهائية',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          kind: { type: Type.STRING, enum: ['midterm', 'final', 'quiz', 'project'] },
          weekNumber: { type: Type.NUMBER },
          date: { type: Type.STRING, description: 'YYYY-MM-DD أو فارغ إن لم يُذكر' },
          gradeWeight: { type: Type.NUMBER, description: 'النسبة من الدرجة النهائية 0-100' },
          coversWeeks: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: 'أرقام الأسابيع التي تغطيها المحطة',
          },
        },
        required: ['title', 'kind', 'weekNumber'],
      },
    },
    duckNote: { type: Type.STRING, description: 'سطر تحفيزي قصير بلهجة كواكلي' },
  },
  required: ['weeks', 'milestones'],
};
