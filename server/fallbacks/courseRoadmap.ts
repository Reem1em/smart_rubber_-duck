/**
 * Served when every model in the chain fails to read the syllabus.
 *
 * It never invents syllabus content: it only spreads the concepts the student's own
 * material already produced across a plain chronological schedule, and says so.
 */
const DEFAULT_TERM_WEEKS = 12;
const MAX_CONCEPTS_PER_WEEK = 3;

export function courseRoadmapFallback(body: any) {
  const conceptNames: string[] = Array.isArray(body?.conceptNames)
    ? body.conceptNames.map((n: unknown) => String(n)).filter(Boolean)
    : [];
  const todayIso: string =
    typeof body?.todayIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.todayIso)
      ? body.todayIso
      : new Date().toISOString().slice(0, 10);

  const totalWeeks =
    conceptNames.length > 0
      ? Math.min(DEFAULT_TERM_WEEKS, Math.ceil(conceptNames.length / MAX_CONCEPTS_PER_WEEK))
      : 1;
  const perWeek = Math.max(Math.ceil(conceptNames.length / Math.max(totalWeeks, 1)), 1);

  const weeks = Array.from({ length: totalWeeks }, (_, index) => {
    const slice = conceptNames.slice(index * perWeek, (index + 1) * perWeek);
    return {
      weekNumber: index + 1,
      title: slice[0] ? `الأسبوع ${index + 1}: ${slice[0]}` : `الأسبوع ${index + 1}`,
      concepts: slice,
      highYield: false,
      isReviewWeek: false,
    };
  });

  return {
    courseName: typeof body?.courseName === 'string' ? body.courseName : 'المقرر الدراسي',
    startDate: todayIso,
    totalWeeks,
    weeks,
    milestones: [
      {
        title: 'الاختبار النهائي (موعد تقديري)',
        kind: 'final',
        weekNumber: totalWeeks,
        date: '',
        gradeWeight: 0,
        coversWeeks: weeks.map((w) => w.weekNumber),
      },
    ],
    duckNote:
      'كواك! ما قدرت أقرأ التوصيف هالمرة، فوزّعت مفاهيمك بترتيبها. عدّل التواريخ يدوياً أو جرّب رفع الملف مرة ثانية.',
  };
}
