/** Final mastery report prompt, combining every stage of the session. */
export function buildFinalDiagnosisPrompt({ conceptName, statedConfidence, understandingScore, diagnosis, socraticAnswer, transferAnswer, qScore, qTotal, quizPercentage }: {
  conceptName: string;
  statedConfidence: number;
  understandingScore: number;
  diagnosis: any;
  socraticAnswer?: string;
  transferAnswer?: string;
  qScore: number;
  qTotal: number;
  quizPercentage: number;
}): string {
  const prompt = `أنت البطة السقراطية التعلمية وخبير التقييم التربوي.
المفهوم المستهدف: "${conceptName}"
بيانات التشخيص الأولي:
- الثقة المعلنة: ${statedConfidence}%
- الفهم الأولي المقدر: ${understandingScore}%
- الفجوة السابقة: ${diagnosis?.gapType || 'غير محددة'} (${diagnosis?.gapDescription || ''})

مسار التعلم والتحديات:
- إجابة الطالب على السؤال السقراطي: "${socraticAnswer || 'تفاعل طيب'}"
- حل تحدي نقل المعرفة: "${transferAnswer || 'تطبيق ناجح'}"
- نتيجة الاختبار القصير النهائي حول المادة: ${qScore} من ${qTotal} (${quizPercentage}%)

مهمتك:
1. احتساب درجة الإتقان النهائية الشاملة (masteryScore) من 0 إلى 100 مع الأخذ في الاعتبار نتيجة الاختبار القصير وحل التحدي وتصحيح الثغرات السابقة.
2. تحديد ما إذا كانت فجوة الثقة قد حُلت بنجاح (gapResolved = true/false).
3. كتابة حكم وخلاصة تقييمية بليغة ومشجعة من البطة (duckVerdict) باللغة العربية الفصحى.
4. تحديد حالة البطة المزاجية (duckMood: 'proud' أو 'encouraging' أو 'thinking').
5. تقديم تحليل مفصل يتضمن:
   - initialConfidence (${statedConfidence})
   - initialUnderstanding (${understandingScore})
   - finalMastery (الدرجة المحسوبة)
   - keyLearnings (مصفوفة باللغة العربية بأهم المفاهيم التي أتقنها الطالب في المادة)
   - remainingGaps (مصفوفة بالثغرات المتبقية إن وجدت، أو مصفوفة فارغة إذا كان الإتقان ممتازاً)`;

  return prompt;
}
