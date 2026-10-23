/**
 * Real execution results (run in the student's browser by Pyodide) for code grading.
 *
 * The client's report is validated and length-capped here, the success flag is recomputed
 * from its parts, and pass/fail is decided by the shared comparison rule — so the model is
 * handed facts to explain, never a verdict to make.
 */
import type { CodeExecutionReport, CustomLabTestCase, CustomLabTestResult, CustomLabTestRun, SampleCheck } from '../src/types';
import { isExecutionSuccess, outputsMatch } from '../src/services/execution/compare';

export const DETERMINISTIC_EVALUATION_MANDATE =
  'DETERMINISTIC EVALUATION MANDATE: Do NOT guess if the code works. The code has already been executed. Use the provided `executionSuccess` and `error` variables as absolute truth. If `executionSuccess` is false, your ONLY job is to act as a Socratic rubber duck. Analyze the actual error/output mismatch, and guide the student towards fixing it themselves without giving them the direct answer.';

const MAX_OUTPUT = 4000;
const MAX_ERROR = 1000;
const MAX_SAMPLES = 6;

const clip = (raw: unknown, max: number): string => (typeof raw === 'string' ? raw.slice(0, max) : '');

function parseSampleCheck(raw: any): SampleCheck | null {
  const expression = clip(raw?.expression, 300);
  const expected = clip(raw?.expected, 300);
  if (!expression || !expected) return null;
  const error = clip(raw?.error, MAX_ERROR);
  return {
    expression,
    expected,
    actual: clip(raw?.actual, 300),
    passed: raw?.passed === true && !error,
    ...(error ? { error } : {}),
  };
}

/** Validates a Builder / Bug-Hunter execution report; null when absent or malformed. */
export function parseExecutionReport(raw: unknown): CodeExecutionReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.actualOutput !== 'string' || typeof body.consoleErrors !== 'string') return null;

  const sampleChecks = (Array.isArray(body.sampleChecks) ? body.sampleChecks : [])
    .map(parseSampleCheck)
    .filter((c): c is SampleCheck => c !== null)
    .slice(0, MAX_SAMPLES);
  const report = {
    actualOutput: clip(body.actualOutput, MAX_OUTPUT),
    consoleErrors: clip(body.consoleErrors, MAX_ERROR),
    timedOut: body.timedOut === true,
    sampleChecks,
  };
  // Recomputed, never trusted: the flag must agree with the facts it summarizes.
  return { ...report, executionSuccess: isExecutionSuccess(report, sampleChecks) };
}

/** Validates Custom Lab runs; null unless there is exactly one run per test case, in order. */
export function parseTestRuns(raw: unknown, testCount: number): CustomLabTestRun[] | null {
  if (!Array.isArray(raw) || raw.length !== testCount || testCount === 0) return null;
  const runs = raw.map((r: any, i): CustomLabTestRun | null => {
    if (r?.testIndex !== i || typeof r?.actualOutput !== 'string') return null;
    const error = clip(r.error, MAX_ERROR);
    return {
      testIndex: i,
      actualOutput: clip(r.actualOutput, MAX_OUTPUT),
      ...(error ? { error } : {}),
      ...(r.timedOut === true ? { timedOut: true } : {}),
    };
  });
  return runs.every((r) => r !== null) ? (runs as CustomLabTestRun[]) : null;
}

/** Deterministic test table: pass only when there was no error and the output matches literally. */
export function judgeTestRuns(testCases: CustomLabTestCase[], runs: CustomLabTestRun[]): CustomLabTestResult[] {
  return testCases.map((tc, i) => {
    const run = runs[i];
    return {
      testIndex: i,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: run.error ? `${run.actualOutput}${run.actualOutput ? '\n' : ''}خطأ: ${run.error}` : run.actualOutput,
      passed: !run.error && outputsMatch(run.actualOutput, tc.expectedOutput),
    };
  });
}

/** Prompt block stating the execution facts for a Builder / Bug-Hunter submission. */
export function buildExecutionBlock(report: CodeExecutionReport): string {
  const samples = report.sampleChecks.length
    ? report.sampleChecks
        .map(
          (c) =>
            `- ${c.expression} → المتوقع ${JSON.stringify(c.expected)}، الفعلي ${
              c.error ? `خطأ: ${c.error}` : JSON.stringify(c.actual)
            } ${c.passed ? '✅' : '❌'}`
        )
        .join('\n')
    : '- (لا توجد أمثلة قابلة للتنفيذ)';

  return `${DETERMINISTIC_EVALUATION_MANDATE}
نتائج التنفيذ الفعلي (Pyodide، حقائق نهائية لا تقبل الاجتهاد):
executionSuccess: ${report.executionSuccess}
error: ${report.consoleErrors ? JSON.stringify(report.consoleErrors) : 'null'}
المخرج الفعلي (stdout): ${report.actualOutput ? JSON.stringify(report.actualOutput) : '(لا شيء)'}
نتائج الأمثلة المنفذة:
${samples}`;
}
