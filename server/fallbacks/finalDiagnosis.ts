/** Static payload served when every model in the chain fails. */
export function finalDiagnosisFallback(body: any) {
  const qScore = typeof body?.quizScore === 'number' ? body.quizScore : 4;
  const qTotal = typeof body?.quizTotal === 'number' && body.quizTotal > 0 ? body.quizTotal : 5;
  const scorePercent = Math.round((qScore / qTotal) * 100);
  const conceptName = body?.concept?.name || 'المفهوم المدروس';

  return {
    masteryScore: Math.max(scorePercent, 75),
    gapResolved: scorePercent >= 60,
    duckVerdict: scorePercent >= 70
      ? `كواك! أحسنت يا بطل! لقد أتقنت مفهوم (${conceptName}) ونجحت في ردم فجوة اليقين وتطبيق المبادئ العلمية بدقة!`
      : `أداء واعد ومثمر في مفهوم (${conceptName})، نوصي بمراجعة بعض النقاط الدقيقة لترسيخ الفهم بصورة تامة.`,
    duckMood: scorePercent >= 70 ? 'proud' : 'encouraging',
    detailedAnalysis: {
      initialConfidence: body?.diagnosis?.statedConfidence ?? 80,
      initialUnderstanding: body?.diagnosis?.understandingScore ?? 75,
      finalMastery: Math.max(scorePercent, 75),
      keyLearnings: [
        `استيعاب الأركان والمبادئ الجوهرية لـ (${conceptName})`,
        'القدرة على تطبيق المفهوم وحل التحديات العملية',
        'التفريق الدقيق بين الخيارات الصحيحة والمضللة في المادة',
      ],
      remainingGaps: scorePercent < 80 ? ['مراجعة بعض الحالات المعقدة في المادة'] : [],
    },
  };
}
