/**
 * Student answers arrive through the Web Speech API, which mangles technical terms
 * ("ريكيرجن" for recursion, "ديترمنانت" for determinant, dialect spellings). Every prompt
 * that grades a spoken answer injects this rule so the score reflects understanding,
 * not the transcriber's accuracy.
 */
export function buildTranscriptionToleranceRule({ scoreField, flawsField }: {
  /** Schema field holding the score that must not be lowered for transcription noise. */
  scoreField: string;
  /** Schema field listing errors, where transcription noise must not be reported. */
  flawsField: string;
}): string {
  return `TRANSCRIPTION TOLERANCE MANDATE: The student's explanation is transcribed by an automated Voice-to-Text system. You MUST ignore phonetic typos, dialect artifacts, and slight spelling mistakes of scientific or programming terms. Do NOT penalize the student's \`${scoreField}\` or flag these as \`${flawsField}\` unless the core scientific or logical meaning is fundamentally flawed.
قاعدة التسامح مع التفريغ الصوتي (إلزامية):
- شرح الطالب مفرَّغ آلياً من الصوت؛ افهم المصطلح المقصود من السياق (مثل "ريكيرجن" = recursion، "ديترمنانت" = determinant) وقيّم المعنى لا الإملاء.
- الأخطاء الصوتية واللهجية والإملائية في المصطلحات لا تُنقص ${scoreField} ولا تُذكر في ${flawsField}، ولا تصحّحها للطالب.
- يُحاسَب الطالب فقط إذا كان المعنى العلمي أو المنطقي نفسه خاطئاً.`;
}
