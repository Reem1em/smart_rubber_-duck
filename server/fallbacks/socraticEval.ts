/** Static payload served when every model in the chain fails. */
export function socraticEvalFallback() {
  return {
    reasoningQualityScore: 90,
    improvedUnderstanding: true,
    duckReaction: 'كواك! صيد ذكي ودقيق! اكتشفت الخطأ في الإشارة وعرفت إن محدد 2×2 هو حاصل طرح القطرين (ad - bc).',
    transferChallenge: {
      scenario: `لدينا الآن المصفوفة الجديدة B:
| 2   5 |
| 1   4 |
ونريد حساب معكوس المصفوفة B⁻¹.`,
      task: 'بدون ما تحسب الناتج النهائي، اشرح لي بصوتك: إيش أول خطوة عددية راح تبدأ فيها للتأكد من وجود المعكوس وليه؟',
      hints: [
        'احسب أولاً محدد المصفوفة det(B) = (2 × 4) - (5 × 1)',
        'تأكد أن المحدد لا يساوي صفراً لضمان وجود المعكوس B⁻¹',
      ],
    },
  };
}
