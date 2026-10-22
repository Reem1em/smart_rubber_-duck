/**
 * Safe offline fallback for quiz answer evaluation.
 * The verdict comes from the answer key in the request; the explanation is the
 * question's own reference explanation, so nothing is fabricated.
 */
export function quizEvalFallback(body: any): object {
  const correctIndex = body?.question?.correctAnswerIndex;
  const isCorrect =
    Number.isInteger(correctIndex) &&
    Number.isInteger(body?.studentAnswerIndex) &&
    body.studentAnswerIndex === correctIndex;
  const reference = typeof body?.question?.explanation === 'string' ? body.question.explanation.trim() : '';

  return {
    degraded: true,
    status: isCorrect ? 'correct' : 'incorrect',
    overall_assessment: isCorrect
      ? 'أحسنت! اخترت الإجابة الصحيحة، لكن تعذّر على كواكلي إعداد تقييم تفصيلي الآن.'
      : 'الإجابة المختارة غير صحيحة، وتعذّر على كواكلي إعداد تقييم تفصيلي الآن.',
    correct_points: isCorrect ? ['اخترت الإجابة الصحيحة'] : [],
    incorrect_points: isCorrect ? [] : ['الإجابة المختارة ليست الصحيحة'],
    missing_points: [],
    explanation: reference || 'تعذّر الاتصال بمحرك التقييم حالياً. يرجى المحاولة مرة أخرى لاحقاً.',
    suggested_correction: isCorrect
      ? 'أكمل الاختبار وراجع باقي الأسئلة.'
      : 'راجع الشرح أعلاه وتأمل لماذا الخيار الصحيح هو الصحيح.',
    needs_clarification: false,
  };
}

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
