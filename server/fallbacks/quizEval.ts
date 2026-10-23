/**
 * Safe offline fallback for a quiz discussion message.
 */
export function quizDiscussionFallback(_body: any): object {
  return {
    degraded: true,
    reply:
      'عذراً، تعذّر الاتصال بكواكلي الآن للإجابة على سؤالك. يمكنك مراجعة الشرح المرجعي للسؤال أو المحاولة مرة أخرى لاحقاً.',
  };
}
