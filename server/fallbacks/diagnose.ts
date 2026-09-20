/** Static payload served when every model in the chain fails. */
export function diagnoseFallback(body: any) {
  const conf = body?.confidenceLevel || 80;
  return {
    statedConfidence: conf,
    understandingScore: 75,
    gapScore: Math.abs(conf - 75),
    gapType: conf > 85 ? 'overconfident' : 'calibrated',
    gapDescription: 'شرحك الرياضي جيد، لكن توجد ثغرة في تطبيق الخطوات الميكانيكية الدقيقة تحتاج لضبط وشرح صوتي.',
    identifiedFlaws: ['الخلط المحتمل بين إشارات الحدود في العمليات الحسابية'],
    strengths: ['استيعاب الهدف العام من العملية الرياضية'],
    socraticQuestion: `السؤال:
لدينا المصفوفتان:
المصفوفة A =
[ 1   2 ]

المصفوفة B =
[ 5   9 ]

إذا قام الزميل بحساب ضرب A × B كالتالي:
[ (1 × 5) + (2 × ?) ]

وين الغلطة الحسابية أو المنطقية في حله؟ اشرح لي بصوتك إيش الخطوة الصح.`,
    socraticHint: 'تذكر قاعدة ضرب مصفوفة في مصفوفة: عناصر الصف الأول في A تُضرب في عناصر العمود الأول في B.',
  };
}
