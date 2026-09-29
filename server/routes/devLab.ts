import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildDevChallengePrompt, buildDevEvaluationPrompt, buildCustomLabEvaluationPrompt, CustomLabTestCase, DevLabMode } from '../prompts/devLab';
import { devChallengeSchema, devEvaluationSchema, customLabEvaluationSchema } from '../schemas/devLab';
import { devChallengeFallback, devEvaluationFallback, customLabEvaluationFallback } from '../fallbacks/devLab';

const normalizeMode = (raw: unknown): DevLabMode => (raw === 'bugHunter' ? 'bugHunter' : 'builder');

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

    const prompt = buildDevChallengePrompt({ mode, language, level });

    const response = await generateInteractive({
      contents: prompt,
      config: {
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

/** Grades a Code Lab submission against correctness, edge cases and code quality. */
export const handleEvaluateDevSubmission = async (req: Request, res: Response) => {
  try {
    const mode = normalizeMode(req.body?.mode);
    const { language, level, challenge, studentCode, studentExplanation } = req.body || {};

    const prompt = buildDevEvaluationPrompt({
      mode,
      language: language || 'Python',
      level: level || 'Intermediate',
      challenge: challenge || '',
      studentCode: studentCode || '',
      studentExplanation,
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: devEvaluationSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed?.score !== 'number' || !parsed?.verdict) {
      throw new Error('Invalid dev evaluation response');
    }

    return res.json(parsed);
  } catch (err: any) {
    return handleModelFailure(res, 'dev-lab', err, () => devEvaluationFallback());
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

  try {
    const prompt = buildCustomLabEvaluationPrompt({ taskPrompt, language, testCases, constraints, studentCode });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: customLabEvaluationSchema,
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
    });
  } catch (err: any) {
    return handleModelFailure(res, 'custom-lab', err, () => customLabEvaluationFallback(testCases));
  }
};
