/**
 * Route-level tests for execution-bound grading with the model mocked: real execution
 * results must bind the grade no matter what the model answers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../gemini', () => ({
  generateInteractive: vi.fn(),
  isQuotaOrRateLimitError: () => false,
  isServerOverloadError: () => false,
}));
vi.mock('../auth/session', () => ({ bearerToken: () => null, verifySession: () => null }));
vi.mock('../auth/courseStore', () => ({ getUserCourse: vi.fn(async () => undefined) }));

import { generateInteractive } from '../gemini';
import { handleEvaluateCustomLab, handleEvaluateDevSubmission } from './devLab';

const mockModel = vi.mocked(generateInteractive);

function call(handler: (req: any, res: any) => Promise<unknown>, body: any) {
  const res: any = { statusCode: 200 };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (b: any) => ((res.body = b), res);
  return handler({ body, headers: {}, params: {} }, res).then(() => res);
}

beforeEach(() => mockModel.mockReset());

describe('dev submission bound to execution', () => {
  const crashed = {
    executionSuccess: true, // client claim; the server recomputes it
    actualOutput: '',
    consoleErrors: 'Line 3: ZeroDivisionError: division by zero',
    sampleChecks: [],
  };

  it('caps the score and withholds the fix when the code crashed', async () => {
    mockModel.mockResolvedValue({
      text: JSON.stringify({
        score: 95,
        verdict: 'ممتاز',
        whatWorked: [],
        flaws: [],
        edgeCaseResilience: [],
        codeQuality: [],
        improvedCode: 'def fixed(): pass',
        mastery: 'mastered',
      }),
    } as any);
    const res = await call(handleEvaluateDevSubmission, {
      mode: 'builder',
      language: 'Python',
      challenge: 'avg',
      studentCode: 'def avg(xs): return sum(xs)/len(xs)',
      execution: crashed,
    });
    expect(res.body.score).toBeLessThan(60);
    expect(res.body.mastery).toBe('needs-work');
    expect(res.body.improvedCode).toBe('');
    expect(res.body.verifiedByExecution).toBe(true);
    const prompt = (mockModel.mock.calls[0][0] as any).contents as string;
    expect(prompt).toContain('DETERMINISTIC EVALUATION MANDATE');
    expect(prompt).toContain('executionSuccess: false');
  });

  it('ignores execution reports for languages that cannot run in the browser', async () => {
    mockModel.mockResolvedValue({ text: JSON.stringify({ score: 80, verdict: 'ok', improvedCode: 'x' }) } as any);
    const res = await call(handleEvaluateDevSubmission, {
      mode: 'builder',
      language: 'C++',
      studentCode: 'int main(){}',
      execution: crashed,
    });
    expect(res.body.verifiedByExecution).toBe(false);
    expect(res.body.score).toBe(80);
  });
});

describe('custom lab bound to execution', () => {
  it('takes pass/fail from the real runs even if the model disagrees', async () => {
    mockModel.mockResolvedValue({
      text: JSON.stringify({ rootCauseAnalysis: 'سبب', hint: 'تلميح', constraintNotes: [], edgeCaseChallenge: '' }),
    } as any);
    const res = await call(handleEvaluateCustomLab, {
      taskPrompt: 'اجمع رقمين',
      language: 'Python',
      studentCode: 'print(int(input())-int(input()))',
      testCases: [{ input: '2\n3', expectedOutput: '5' }],
      testRuns: [{ testIndex: 0, actualOutput: '-1\n' }],
    });
    expect(res.body.verifiedByExecution).toBe(true);
    expect(res.body.allPassed).toBe(false);
    expect(res.body.testResults[0]).toMatchObject({ actualOutput: '-1\n', passed: false });
    const params = mockModel.mock.calls[0][0] as any;
    expect(params.config.responseSchema.properties.testResults).toBeUndefined();
  });
});
