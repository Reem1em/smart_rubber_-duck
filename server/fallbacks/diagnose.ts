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
    socraticQuestion: `المصفوفة A:

$$A = \\begin{bmatrix} 1 & 4 \\\\ 2 & 3 \\end{bmatrix}$$

خطوة كواكلي:

$$\\det(A) = (1 \\times 3) + (4 \\times 2) = 11$$

وين الغلطة في خطوتي؟ اشرح لي بصوتك إيش الخطوة الصح وليه.`,
    socraticHint: 'راجع إشارة العملية في قاعدة محدد المصفوفة 2×2: هل هي جمع للقطرين أم طرح؟',
  };
}
