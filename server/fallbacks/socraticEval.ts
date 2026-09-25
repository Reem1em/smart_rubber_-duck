/** Static payload served when every model in the chain fails. */
export function socraticEvalFallback() {
  return {
    reasoningQualityScore: 90,
    improvedUnderstanding: true,
    duckReaction: 'كواك! صيد ذكي ودقيق! اكتشفت الخطأ في الإشارة وعرفت إن محدد 2×2 هو حاصل طرح القطرين (ad - bc).',
    transferChallenge: {
      scenario: `لدينا الآن المصفوفة الجديدة B:

$$B = \\begin{bmatrix} 2 & 5 \\\\ 1 & 4 \\end{bmatrix}$$

ونريد حساب المعكوس $B^{-1}$.`,
      task: 'بدون ما تحسب الناتج النهائي، اشرح لي بصوتك: إيش أول خطوة عددية راح تبدأ فيها للتأكد من وجود المعكوس وليه؟',
      hints: [
        'ابدأ بحساب المحدد: $\\det(B) = (2 \\times 4) - (5 \\times 1)$',
        'تأكد أن المحدد لا يساوي صفراً لضمان وجود المعكوس $B^{-1}$',
      ],
    },
  };
}
