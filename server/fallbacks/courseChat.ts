/** Served when every model in the chain fails; keeps the student moving, not stuck. */
export function courseChatFallback(body: any) {
  const concept =
    typeof body?.focusConcept?.name === 'string' ? body.focusConcept.name : 'هذا المفهوم';

  return {
    reply: `كواك! تعذّر عليّ الوصول للنموذج الحين، بس لا توقف.

جرّب هذي: افتح ملخص "${concept}" في مادتك، واقرأ أول سطرين بس — ثم سكّر الملف واشرحه لي بصوتك من راسك. اللي تتعثر فيه وأنت تشرح هو بالضبط الثغرة اللي نبي نصطادها.

جاهز تشرحه لي بصوتك؟`,
    degraded: true,
  };
}
