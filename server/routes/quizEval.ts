import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleAssessmentFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildSystemPrompt } from '../utils/loadAgent';
import { buildQuizDiscussionPrompt } from '../prompts/quizEval';
import { quizDiscussionSchema, validateQuizAnswerBody, sanitizeDiscussion } from '../schemas/quizEval';
import { isStemTopic } from '../stem';
import { buildCourseScopeBlock, resolveCourseScope, scopeSubjectText } from '../courseScope';

const SYSTEM_PROMPT = buildSystemPrompt('05_EVALUATOR.md');

const INVALID_BODY = 'بيانات الطلب غير مكتملة.';

/**
 * POST /api/quiz/discuss
 *
 * Follow-up discussion about an already-evaluated question. Explains and clarifies;
 * it never changes the grade.
 *
 * Body:
 *   question            – QuizQuestion object
 *   studentAnswerIndex  – the option index the student selected
 *   concept             – { name, summary }
 *   previousEvaluation  – the instant client-side feedback { status, explanation }
 *   conversationHistory – earlier turns, NOT including newMessage
 *   newMessage          – the student's latest message
 */
export const handleQuizDiscuss = async (req: Request, res: Response) => {
  const valid = validateQuizAnswerBody(req.body);
  const discussion = sanitizeDiscussion(req.body);
  if (!valid.ok || !discussion.ok) {
    return res.status(400).json({ error: INVALID_BODY });
  }
  const scoped = await resolveCourseScope(req);
  if ('error' in scoped) return res.status(400).json({ error: scoped.error });

  try {
    const { question, studentAnswerIndex } = valid;
    const { concept, previousEvaluation } = req.body;
    const conceptName = typeof concept?.name === 'string' && concept.name ? concept.name : 'المفهوم المدروس';
    const isCorrect = studentAnswerIndex === question.correctAnswerIndex;

    const isStem = isStemTopic(scopeSubjectText(scoped.scope), conceptName, concept?.summary, question.question);

    const prompt = buildQuizDiscussionPrompt({
      question: question.question,
      correctOptionText: question.options[question.correctAnswerIndex],
      studentOptionText: question.options[studentAnswerIndex],
      isCorrect,
      previousExplanation:
        typeof previousEvaluation?.explanation === 'string' ? previousEvaluation.explanation.slice(0, 1500) : '',
      conversationHistory: discussion.history,
      newMessage: discussion.newMessage,
      conceptName,
      isStem,
      courseScopeBlock: buildCourseScopeBlock(scoped.scope, conceptName),
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: quizDiscussionSchema,
        // Fully deterministic: the discussion must never drift from the answer key.
        temperature: 0.0,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed?.reply !== 'string' || !parsed.reply.trim()) {
      throw new Error('Empty quiz discussion reply');
    }

    return res.json({ reply: parsed.reply });
  } catch (err: any) {
    return handleAssessmentFailure(res, 'quiz-discuss', err);
  }
};
