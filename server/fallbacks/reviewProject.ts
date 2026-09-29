/** Unrated: no score or invented review for code the reviewer never saw. */
export function projectReviewFallback() {
  return {
    score: null,
    summary: 'كواك! السيرفرات زحمة فما قدرت أراجع كودك الحين — جرّب مرة ثانية بعد شوي.',
    strengths: [],
    gaps: [],
    bestPractices: [],
    improvedCodeSnippet: '',
  };
}
