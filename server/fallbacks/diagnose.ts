/**
 * Served when every model attempt fails. It deliberately makes no claim about the
 * student's understanding (score mirrors stated confidence, no invented flaws) and
 * falls back to a concept-agnostic Strategy Think-Aloud prompt.
 */
export function diagnoseFallback(body: any) {
  const conf = typeof body?.confidenceLevel === 'number' ? body.confidenceLevel : 80;
  const name = body?.concept?.name || 'هذا المفهوم';
  const principle = Array.isArray(body?.concept?.keyPrinciples) ? body.concept.keyPrinciples[0] : '';

  return {
    statedConfidence: conf,
    understandingScore: conf,
    gapScore: 0,
    gapType: 'calibrated',
    gapDescription: 'كواك! السيرفرات زحمة شوي فما قدرت أحلل شرحك بالتفصيل — شرحك محفوظ، وخلنا نكمل بسؤال تفكير.',
    identifiedFlaws: [],
    strengths: [],
    socraticQuestion: `قبل أي حل: اشرح لي بصوتك، وش أول خطوة تبدأ فيها لو طبّقت (${name}) على مثال جديد، وليه هذي بالذات؟`,
    socraticHint: principle ? `ابدأ من المبدأ الأساسي: ${principle}` : 'ابدأ من تعريف المفهوم، وبعدين طبّقه على مثال صغير.',
  };
}
