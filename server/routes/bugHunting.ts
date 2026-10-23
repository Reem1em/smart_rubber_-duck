import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleAssessmentFailure, handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildBugChallengePrompt, buildBugEvaluationPrompt } from '../prompts/bugHunting';
import { bugChallengeSchema, bugEvaluationSchema } from '../schemas/bugHunting';
import { bugChallengeFallback } from '../fallbacks/bugHunting';
import { isStemTopic } from '../stem';
import { buildLabScopeBlock, resolveCourseScope } from '../courseScope';
import { parseExecutionReport } from '../execution';
import { isPythonLanguage } from '../../src/services/execution/compare';

export const handleGenerateBugChallenge = async (req: Request, res: Response) => {
  try {
    const { language, difficulty } = req.body;
    const scoped = await resolveCourseScope(req);
    if ('error' in scoped) return res.status(400).json({ error: scoped.error });

    // No hard-coded subject: an unnamed topic falls back to the active course, never to another subject.
    const lang = language || scoped.scope?.courseTitle || 'Python';
    const diff = difficulty || 'Intermediate';

    const isMath = isStemTopic(lang);

    const prompt = buildBugChallengePrompt({ isMath, lang, diff, scopeBlock: buildLabScopeBlock(scoped.scope) });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: bugChallengeSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (parsed.challenge && parsed.challenge.buggyCode) {
      return res.json(parsed);
    }
    throw new Error('Invalid bug challenge response');
  } catch (err: any) {
    return handleModelFailure(res, 'bug-hunting', err, () => bugChallengeFallback(req.body));
  }
};

export const handleEvaluateBugChallenge = async (req: Request, res: Response) => {
  try {
    const { buggyCode, userFixDescription, expectedBehavior, language } = req.body;
    // Real results of the student's fixed code, when it was Python and run in the browser.
    const execution = typeof language === 'string' && isPythonLanguage(language) ? parseExecutionReport(req.body?.execution) : null;
    const scoped = await resolveCourseScope(req);
    if ('error' in scoped) return res.status(400).json({ error: scoped.error });

    const prompt = buildBugEvaluationPrompt({
      buggyCode,
      userFixDescription,
      expectedBehavior,
      isMath: isStemTopic(language, expectedBehavior, buggyCode),
      scopeBlock: buildLabScopeBlock(scoped.scope),
      execution,
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: bugEvaluationSchema,
        temperature: 0.0,
      },
    });

    const parsed = parseModelJson(response.text);
    if (execution && !execution.executionSuccess) {
      // A fix that still crashes cannot pass, and the Socratic contract withholds the answer.
      return res.json({
        ...parsed,
        score: typeof parsed?.score === 'number' ? Math.min(parsed.score, 59) : null,
        correctedCode: '',
        verifiedByExecution: true,
      });
    }
    return res.json({ ...parsed, verifiedByExecution: execution !== null });
  } catch (err: any) {
    return handleAssessmentFailure(res, 'bug-hunting', err);
  }
};
