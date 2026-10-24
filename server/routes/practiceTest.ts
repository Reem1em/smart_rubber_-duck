import type { Request, Response } from 'express';

import { generateWithRetry, isQuotaOrRateLimitError } from '../gemini';
import { handleAssessmentFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildSystemPrompt } from '../utils/loadAgent';
import { buildPracticeTestPrompt } from '../prompts/practiceTest';
import { practiceTestSchema } from '../schemas/practiceTest';
import { parsePracticeTestRequest, verifyPracticeQuestions } from '../practiceTest';
import { isStemTopic } from '../stem';

const SYSTEM_PROMPT = buildSystemPrompt('03_GENERATOR.md');

/** Worked reasoning for up to 20 questions over ~60k chars of context takes longer than a quiz. */
const PRACTICE_TEST_TIMEOUT_MS = 90_000;
/** Enough of each document to detect a STEM subject without scanning everything. */
const STEM_SNIFF_CHARS = 3_000;

const GENERATION_FAILED = 'تعذر بناء اختبار تدريبي موثوق من المستندات المرفقة. يرجى المحاولة مرة أخرى.';

export const handleGeneratePracticeTest = async (req: Request, res: Response) => {
  const parsed = parsePracticeTestRequest(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { subjectId, difficulty, questionCount, documents } = parsed.request;

  try {
    const isStem = isStemTopic(subjectId, ...documents.map((d) => d.text.slice(0, STEM_SNIFF_CHARS)));

    const response = await generateWithRetry(
      {
        contents: buildPracticeTestPrompt({ subjectId, difficulty, questionCount, documents, isStem }),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: practiceTestSchema,
        },
      },
      PRACTICE_TEST_TIMEOUT_MS
    );

    const questions = verifyPracticeQuestions(parseModelJson(response.text).questions, questionCount);
    if (questions.length === 0) throw new Error('No practice question passed answer verification');

    return res.json({ questions, requestedCount: questionCount, difficulty });
  } catch (err: any) {
    // A canned test would be questions the documents never contained, so there is no fallback.
    if (isQuotaOrRateLimitError(err)) return handleAssessmentFailure(res, 'practice-test', err);
    console.error('[practice-test] generation failed:', err?.message || err);
    return res.status(503).json({ error: GENERATION_FAILED });
  }
};
