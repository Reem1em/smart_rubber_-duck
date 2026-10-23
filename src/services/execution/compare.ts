/**
 * Deterministic output comparison shared by the browser runner and the server, so a
 * test case passes or fails by the same rule on both sides — never by a model's opinion.
 */
import type { CodeExecutionReport, SampleCheck } from '../../types';

/** Line endings unified and trailing newlines dropped (print() always appends one). */
export function normalizeOutput(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
}

/** Literal match after normalizeOutput; spaces and case still count. */
export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

/**
 * A model-written sample like "average_score([80, 90, 100]) => 90.0" split into the
 * expression to evaluate and the expected value. Null when it isn't in that shape.
 */
export function parseSample(sample: string): { expression: string; expected: string } | null {
  const at = sample.indexOf('=>');
  if (at <= 0) return null;
  const expression = sample.slice(0, at).trim();
  const expected = sample.slice(at + 2).trim();
  return expression && expected ? { expression, expected } : null;
}

/** A sample passes if either str() or repr() of the real value equals the expected text. */
export function sampleMatches(actualStr: string, actualRepr: string, expected: string): boolean {
  const want = expected.trim();
  return actualStr.trim() === want || actualRepr.trim() === want;
}

/** The single truth flag: ran without error AND every executable sample matched. */
export function isExecutionSuccess(report: Pick<CodeExecutionReport, 'consoleErrors' | 'timedOut'>, checks: SampleCheck[]): boolean {
  return !report.consoleErrors && !report.timedOut && checks.every((c) => c.passed);
}

/** Only Python runs in the browser; other languages keep the model-only (unverified) review. */
export const isPythonLanguage = (language: string): boolean => /^python\b/i.test(language.trim());
