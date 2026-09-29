/**
 * Served when every model attempt fails. It neither praises nor penalises the answer it
 * could not read, and hands back a concept-agnostic transfer task so the session continues.
 */
export function socraticEvalFallback(body: any) {
  const name = body?.concept?.name || 'المفهوم';

  return {
    reasoningQualityScore: 50,
    improvedUnderstanding: false,
    duckReaction: 'كواك! السيرفرات زحمة فما قدرت أقيّم إجابتك بدقة — بس لا تشيل هم، إجابتك محفوظة. خلنا نكمل بتحدي تطبيقي.',
    transferChallenge: {
      scenario: `طبّق (${name}) على موقف جديد من حياتك اليومية أو من تمرين في ملزمتك، يختلف عن المثال اللي شرحته.`,
      task: 'بدون ما تحل للنهاية، اشرح لي بصوتك: وش أول خطوة راح تسويها وليه؟',
      hints: ['حدد المعطيات والمطلوب أولاً.', 'اربط كل خطوة بالمبدأ اللي تعتمد عليه.'],
    },
  };
}
