/**
 * Served when every model attempt fails. The only measured signal left is the client-graded
 * quiz, so mastery mirrors it exactly; without quiz data the report stays unrated.
 */
export function finalDiagnosisFallback(body: any) {
  const hasQuiz = typeof body?.quizScore === 'number' && typeof body?.quizTotal === 'number' && body.quizTotal > 0;
  const scorePercent = hasQuiz ? Math.round((body.quizScore / body.quizTotal) * 100) : null;
  const conceptName = body?.concept?.name || 'المفهوم المدروس';

  return {
    masteryScore: scorePercent,
    gapResolved: scorePercent !== null && scorePercent >= 60,
    duckVerdict: scorePercent === null
      ? `كواك! السيرفرات زحمة فما قدرت أجهّز تقرير (${conceptName}) — جرّب مرة ثانية بعد شوي.`
      : `كواك! السيرفرات زحمة، فهذا التقرير مبني على نتيجة اختبارك القصير فقط (${scorePercent}%) في (${conceptName}).`,
    duckMood: scorePercent !== null && scorePercent >= 70 ? 'proud' : 'encouraging',
    detailedAnalysis: {
      initialConfidence: body?.diagnosis?.statedConfidence ?? null,
      initialUnderstanding: body?.diagnosis?.understandingScore ?? null,
      finalMastery: scorePercent,
      keyLearnings: [],
      remainingGaps: [],
    },
  };
}
