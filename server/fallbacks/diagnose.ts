/**
 * Served when every model attempt fails. Unrated: understanding, gap and flaws are left
 * empty rather than invented, and the session continues to a concept-agnostic Strategy Think-Aloud prompt.
 */
export function diagnoseFallback(body: any) {
  const conf = typeof body?.confidenceLevel === 'number' ? body.confidenceLevel : 80;
  const name = body?.concept?.name || 'هذا المفهوم';
  const principle = Array.isArray(body?.concept?.keyPrinciples) ? body.concept.keyPrinciples[0] : '';

  return {
    statedConfidence: conf,
    understandingScore: null,
    gapScore: null,
    gapType: null,
    gapDescription: 'كواك! السيرفرات زحمة شوي فما قدرت أحلل شرحك بالتفصيل — شرحك محفوظ، وخلنا نكمل بسؤال تفكير.',
    identifiedFlaws: [],
    strengths: [],
    socraticQuestion: `قبل أي حل: اشرح لي بصوتك، وش أول خطوة تبدأ فيها لو طبّقت (${name}) على مثال جديد، وليه هذي بالذات؟`,
    socraticHint: principle ? `ابدأ من المبدأ الأساسي: ${principle}` : 'ابدأ من تعريف المفهوم، وبعدين طبّقه على مثال صغير.',
  };
}
