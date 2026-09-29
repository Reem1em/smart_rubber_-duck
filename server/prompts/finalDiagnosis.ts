/** Final mastery report prompt, combining every stage of the session. */
export function buildFinalDiagnosisPrompt({ conceptName, statedConfidence, understandingScore, diagnosis, socraticAnswer, transferAnswer, quiz }: {
  conceptName: string;
  statedConfidence: number | null;
  understandingScore: number | null;
  diagnosis: any;
  socraticAnswer?: string;
  transferAnswer?: string;
  quiz: { score: number; total: number } | null;
}): string {
  const pct = (v: number | null) => (v === null ? 'غير مقيّم' : `${v}%`);
  const quizLine = quiz
    ? `${quiz.score} من ${quiz.total} (${Math.round((quiz.score / quiz.total) * 100)}%)`
    : 'لم يُستكمل';
  const prompt = `أنت البطة السقراطية التعلمية وخبير التقييم التربوي.
المفهوم المستهدف: "${conceptName}"
بيانات التشخيص الأولي:
- الثقة المعلنة: ${pct(statedConfidence)}
- الفهم الأولي المقدر: ${pct(understandingScore)}
- الفجوة السابقة: ${diagnosis?.gapType || 'غير محددة'} (${diagnosis?.gapDescription || ''})

مسار التعلم والتحديات:
- إجابة الطالب على السؤال السقراطي: "${socraticAnswer || 'لم يُجب'}"
- حل تحدي نقل المعرفة: "${transferAnswer || 'لم يُجب'}"
- نتيجة الاختبار القصير النهائي حول المادة: ${quizLine}

مهمتك:
1. احتساب درجة الإتقان النهائية الشاملة (masteryScore) من 0 إلى 100 مع الأخذ في الاعتبار نتيجة الاختبار القصير وحل التحدي وتصحيح الثغرات السابقة.
2. تحديد ما إذا كانت فجوة الثقة قد حُلت بنجاح (gapResolved = true/false).
3. كتابة حكم وخلاصة تقييمية بليغة ومشجعة من البطة (duckVerdict) باللغة العربية الفصحى.
4. تحديد حالة البطة المزاجية (duckMood: 'proud' أو 'encouraging' أو 'thinking').
5. تقديم تحليل مفصل يتضمن:
   - initialConfidence (${statedConfidence ?? 'null'})
   - initialUnderstanding (${understandingScore ?? 'null'})
   - finalMastery (الدرجة المحسوبة)
   - keyLearnings (مصفوفة باللغة العربية بأهم المفاهيم التي أتقنها الطالب في المادة)
   - remainingGaps (مصفوفة بالثغرات المتبقية إن وجدت، أو مصفوفة فارغة إذا كان الإتقان ممتازاً)`;

  return prompt;
}
