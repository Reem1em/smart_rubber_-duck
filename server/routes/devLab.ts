import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleAssessmentFailure, handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildSystemPrompt } from '../utils/loadAgent';

const SYSTEM_PROMPT = buildSystemPrompt('04_TUTOR.md');
import {
  buildCustomLabEvaluationPrompt,
  buildCustomLabFeedbackPrompt,
  buildDevChallengePrompt,
  buildDevEvaluationPrompt,
  CustomLabTestCase,
  DevLabMode,
} from '../prompts/devLab';
import { customLabEvaluationSchema, customLabFeedbackSchema, devChallengeSchema, devEvaluationSchema } from '../schemas/devLab';
import { devChallengeFallback } from '../fallbacks/devLab';
import { buildLabScopeBlock, resolveCourseScope } from '../courseScope';
import { judgeTestRuns, parseExecutionReport, parseTestRuns } from '../execution';
import { isPythonLanguage } from '../../src/services/execution/compare';

const normalizeMode = (raw: unknown): DevLabMode => (raw === 'bugHunter' ? 'bugHunter' : 'builder');

/** Highest score for code that crashed or failed an executed sample (always "needs-work"). */
const FAILED_EXECUTION_SCORE_CAP = 59;

const masteryFor = (score: number) => (score < 60 ? 'needs-work' : score < 85 ? 'competent' : 'mastered');

const MAX_TEST_CASES = 3;

/** Coerces untrusted input to a length-capped string. */
const clip = (raw: unknown, max: number): string => (typeof raw === 'string' ? raw.slice(0, max) : '');

/** Keeps up to three well-formed test cases that actually declare an expected output. */
function sanitizeTestCases(raw: unknown): CustomLabTestCase[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tc) => ({ input: clip(tc?.input, 1000), expectedOutput: clip(tc?.expectedOutput, 1000) }))
    .filter((tc) => tc.expectedOutput.trim().length > 0)
    .slice(0, MAX_TEST_CASES);
}

/** Dual-mode Code Lab challenge generator (Feature Builder / Bug-Hunter Lab). */
export const handleGenerateDevChallenge = async (req: Request, res: Response) => {
  try {
    const mode = normalizeMode(req.body?.mode);
    const language = req.body?.language || 'Python';
    const level = req.body?.level || 'Intermediate';

    const scoped = await resolveCourseScope(req);
    if ('error' in scoped) return res.status(400).json({ error: scoped.error });

    const prompt = buildDevChallengePrompt({ mode, language, level, scopeBlock: buildLabScopeBlock(scoped.scope) });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: devChallengeSchema,
      },
    });

    const parsed = parseModelJson(response.text);

    // The model occasionally drops the mode or the snippet Bug-Hunter mode depends on.
    if (!parsed?.title) throw new Error('Invalid dev challenge response');
    if (mode === 'bugHunter' && !parsed.buggyCode) throw new Error('Bug-Hunter challenge missing code');

    return res.json({ ...parsed, mode, language, level });
  } catch (err: any) {
    return handleModelFailure(res, 'dev-lab', err, () => devChallengeFallback(req.body));
  }
};

/**
 * Grades a Code Lab submission against correctness, edge cases and code quality.
 * Python submissions arrive with real Pyodide results (`execution`); those facts bind the
 * grade deterministically, and the model only explains them.
 */
export const handleEvaluateDevSubmission = async (req: Request, res: Response) => {
  try {
    const mode = normalizeMode(req.body?.mode);
    const { level, challenge, studentCode, studentExplanation } = req.body || {};
    const language = clip(req.body?.language, 40) || 'Python';
    const execution = isPythonLanguage(language) ? parseExecutionReport(req.body?.execution) : null;

    const scoped = await resolveCourseScope(req);
    if ('error' in scoped) return res.status(400).json({ error: scoped.error });

    const prompt = buildDevEvaluationPrompt({
      mode,
      language,
      level: level || 'Intermediate',
      challenge: challenge || '',
      studentCode: studentCode || '',
      studentExplanation,
      scopeBlock: buildLabScopeBlock(scoped.scope),
      execution,
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: devEvaluationSchema,
        // Code grading must follow strict logic with no creative deviation.
        temperature: 0.0,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed?.score !== 'number' || !parsed?.verdict) {
      throw new Error('Invalid dev evaluation response');
    }

    // Code that crashed or failed a sample cannot pass, whatever the model wrote, and the
    // Socratic contract forbids handing over the fix.
    const failedExecution = execution !== null && !execution.executionSuccess;
    const score = Math.max(0, Math.min(100, failedExecution ? Math.min(parsed.score, FAILED_EXECUTION_SCORE_CAP) : parsed.score));

    return res.json({
      ...parsed,
      score,
      mastery: masteryFor(score),
      improvedCode: failedExecution ? '' : String(parsed.improvedCode || ''),
      verifiedByExecution: execution !== null,
    });
  } catch (err: any) {
    return handleAssessmentFailure(res, 'dev-lab', err);
  }
};

/**
 * Strict automated judge for a Custom Lab Assignment (مسألة من الملزمة / كود مخصص).
 * Input/expected columns come from the student's own test cases, never the model's echo,
 * and allPassed is recomputed so the verdict always agrees with the table.
 */
export const handleEvaluateCustomLab = async (req: Request, res: Response) => {
  const taskPrompt = clip(req.body?.taskPrompt, 4000);
  const language = clip(req.body?.language, 40) || 'Python';
  const constraints = clip(req.body?.constraints, 1000);
  const studentCode = clip(req.body?.studentCode, 6000);
  const testCases = sanitizeTestCases(req.body?.testCases);

  if (!taskPrompt.trim() || !studentCode.trim()) {
    return res.status(400).json({ error: 'يجب إرسال نص السؤال وكود الطالب.' });
  }
  if (testCases.length === 0) {
    return res.status(400).json({ error: 'يجب تعريف حالة اختبار واحدة على الأقل مع المخرج المتوقع.' });
  }

  const scoped = await resolveCourseScope(req);
  if ('error' in scoped) return res.status(400).json({ error: scoped.error });

  const testRuns = isPythonLanguage(language) ? parseTestRuns(req.body?.testRuns, testCases.length) : null;
  if (testRuns) {
    return evaluateExecutedCustomLab(res, {
      taskPrompt,
      language,
      constraints,
      studentCode,
      testResults: judgeTestRuns(testCases, testRuns),
      scopeBlock: buildLabScopeBlock(scoped.scope),
    });
  }

  try {
    const prompt = buildCustomLabEvaluationPrompt({
      taskPrompt,
      language,
      testCases,
      constraints,
      studentCode,
      scopeBlock: buildLabScopeBlock(scoped.scope),
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: customLabEvaluationSchema,
        // Code grading must follow strict logic with no creative deviation.
        temperature: 0.0,
      },
    });

    const parsed = parseModelJson(response.text);
    if (!Array.isArray(parsed?.testResults) || parsed.testResults.length === 0) {
      throw new Error('Invalid custom lab evaluation response');
    }

    const testResults = testCases.map((tc, i) => {
      const judged = parsed.testResults.find((r: any) => r?.testIndex === i) ?? parsed.testResults[i];
      return {
        testIndex: i,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: typeof judged?.actualOutput === 'string' ? judged.actualOutput : '(لم يُحدَّد)',
        passed: judged?.passed === true,
      };
    });
    const allPassed = testResults.every((r) => r.passed);

    return res.json({
      testResults,
      allPassed,
      rootCauseAnalysis: allPassed ? '' : String(parsed.rootCauseAnalysis || ''),
      constraintNotes: Array.isArray(parsed.constraintNotes) ? parsed.constraintNotes.map(String) : [],
      hint: String(parsed.hint || ''),
      edgeCaseChallenge: allPassed ? String(parsed.edgeCaseChallenge || '') : '',
      verifiedByExecution: false,
    });
  } catch (err: any) {
    return handleAssessmentFailure(res, 'custom-lab', err);
  }
};

/**
 * Executed Custom Lab: the test table was decided by real execution (judgeTestRuns), so the
 * model is asked only for Socratic feedback on it and can never flip a result.
 */
async function evaluateExecutedCustomLab(
  res: Response,
  input: Parameters<typeof buildCustomLabFeedbackPrompt>[0]
) {
  const { testResults } = input;
  const allPassed = testResults.every((r) => r.passed);
  try {
    const response = await generateInteractive({
      contents: buildCustomLabFeedbackPrompt(input),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: customLabFeedbackSchema,
        temperature: 0.0,
      },
    });
    const parsed = parseModelJson(response.text);

    return res.json({
      testResults,
      allPassed,
      rootCauseAnalysis: allPassed ? '' : String(parsed?.rootCauseAnalysis || ''),
      constraintNotes: Array.isArray(parsed?.constraintNotes) ? parsed.constraintNotes.map(String) : [],
      hint: String(parsed?.hint || ''),
      edgeCaseChallenge: allPassed ? String(parsed?.edgeCaseChallenge || '') : '',
      verifiedByExecution: true,
    });
  } catch (err: any) {
    return handleAssessmentFailure(res, 'custom-lab', err);
  }
}
