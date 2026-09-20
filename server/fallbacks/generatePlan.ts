/** Static payload served when every model in the chain fails. */
export function studyPlanFallback(body: any) {
  const hours = body?.dailyStudyHours || 3;
  const examDates = body?.userExamDates || body?.targetExamDate || 'اختبارات قادمة';
  
  const now = new Date();
  const d1 = new Date(now);
  d1.setDate(d1.getDate() + 1);
  const d2 = new Date(now);
  d2.setDate(d2.getDate() + 2);

  const formatArabicDay = (date: Date) => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return `${days[date.getDay()]} - ${date.toISOString().split('T')[0]}`;
  };

  return {
    type: 'study_plan',
    courseName: 'هياكل البيانات والخوارزميات (Data Structures & Algorithms)',
    examScheduleInput: {
      userExamDates: String(examDates),
      dailyStudyHours: String(hours),
    },
    weeklyPlan: [
      {
        day: formatArabicDay(d1),
        tasks: [
          {
            action: 'Review',
            topic: 'أشجار البحث الثنائية (Binary Search Trees)',
            durationMinutes: 60,
          },
          {
            action: 'Practice',
            topic: 'البرمجة كائنية التوجه OOP والوراثة',
            durationMinutes: 45,
          },
        ],
        examMilestoneNotice: 'تنبيه: مراجعة مركزة لربط الفصول الأساسية وبدء العد التنازلي للاختبار.',
      },
      {
        day: formatArabicDay(d2),
        tasks: [
          {
            action: 'Solve Assignment',
            topic: 'استعلامات SQL المتقدمة والربط (JOINs)',
            durationMinutes: 60,
          },
          {
            action: 'Review',
            topic: 'طبقات نموذج OSI وتكشيف الأخطاء',
            durationMinutes: 45,
          },
        ],
        examMilestoneNotice: 'تركيز مكثف لحل أسئلة وتطبيقات عملية قبل موعد الامتحان.',
      },
    ],
  };
}
