import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleAssessmentFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildSystemPrompt } from '../utils/loadAgent';
import { buildSocraticEvalPrompt } from '../prompts/socraticEval';
import { socraticEvalSchema } from '../schemas/socraticEval';
import { isStemTopic } from '../stem';
import { buildCourseScopeBlock, resolveCourseScope, scopeSubjectText } from '../courseScope';

const SYSTEM_PROMPT = buildSystemPrompt('04_TUTOR.md', '05_EVALUATOR.md');

export const handleSocraticEval = async (req: Request, res: Response) => {
  try {
    const { concept, initialExplanation, socraticQuestion, socraticAnswer } = req.body;

    const scoped = await resolveCourseScope(req);
    if ('error' in scoped) return res.status(400).json({ error: scoped.error });

    const isStem = isStemTopic(
      scopeSubjectText(scoped.scope),
      concept?.name,
      concept?.summary,
      concept?.keyPrinciples,
      socraticQuestion
    );

    const prompt = buildSocraticEvalPrompt({
      concept,
      initialExplanation,
      socraticQuestion,
      socraticAnswer,
      isStem,
      courseScopeBlock: buildCourseScopeBlock(scoped.scope, concept?.name || 'المفهوم المدروس'),
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: socraticEvalSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    return res.json(parsed);
  } catch (err: any) {
    return handleAssessmentFailure(res, 'socratic-eval', err);
  }
};
