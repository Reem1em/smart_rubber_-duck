import { describe, expect, it } from 'vitest';

import { buildExecutionBlock, DETERMINISTIC_EVALUATION_MANDATE, judgeTestRuns, parseExecutionReport, parseTestRuns } from './execution';

describe('parseExecutionReport', () => {
  it('rejects a missing or malformed report', () => {
    expect(parseExecutionReport(undefined)).toBeNull();
    expect(parseExecutionReport({ executionSuccess: true })).toBeNull();
  });

  it('recomputes executionSuccess instead of trusting the client flag', () => {
    const report = parseExecutionReport({
      executionSuccess: true,
      actualOutput: '',
      consoleErrors: 'Line 2: ZeroDivisionError: division by zero',
      sampleChecks: [],
    });
    expect(report?.executionSuccess).toBe(false);
  });

  it('treats a sample carrying an error as failed', () => {
    const report = parseExecutionReport({
      actualOutput: '',
      consoleErrors: '',
      sampleChecks: [{ expression: 'f([])', expected: '0', actual: '', passed: true, error: 'ZeroDivisionError' }],
    });
    expect(report?.sampleChecks[0].passed).toBe(false);
    expect(report?.executionSuccess).toBe(false);
  });
});

describe('parseTestRuns + judgeTestRuns', () => {
  const testCases = [
    { input: '2\n3', expectedOutput: '5' },
    { input: '0\n0', expectedOutput: '0' },
  ];

  it('requires exactly one run per test case, in order', () => {
    expect(parseTestRuns([{ testIndex: 0, actualOutput: '5\n' }], 2)).toBeNull();
    expect(parseTestRuns([{ testIndex: 1, actualOutput: '' }, { testIndex: 0, actualOutput: '' }], 2)).toBeNull();
  });

  it('decides pass/fail from the real output, and an error always fails', () => {
    const runs = parseTestRuns(
      [
        { testIndex: 0, actualOutput: '5\n' },
        { testIndex: 1, actualOutput: '0\n', error: 'Line 3: ValueError: boom' },
      ],
      2
    );
    const results = judgeTestRuns(testCases, runs!);
    expect(results.map((r) => r.passed)).toEqual([true, false]);
    expect(results[1].actualOutput).toContain('خطأ: Line 3: ValueError: boom');
  });
});

describe('buildExecutionBlock', () => {
  it('states the mandate and the facts', () => {
    const block = buildExecutionBlock({
      executionSuccess: false,
      actualOutput: '',
      consoleErrors: 'Line 2: ZeroDivisionError: division by zero',
      sampleChecks: [],
    });
    expect(block).toContain(DETERMINISTIC_EVALUATION_MANDATE);
    expect(block).toContain('executionSuccess: false');
    expect(block).toContain('ZeroDivisionError');
  });
});
