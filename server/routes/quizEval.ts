import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildQuizEvalPrompt, buildQuizDiscussionPrompt } from '../prompts/quizEval';
import {
  quizEvalSchema,
  quizDiscussionSchema,
  normalizeQuizEvaluation,
  validateQuizAnswerBody,
  sanitizeDiscussion,
} from '../schemas/quizEval';
import { quizEvalFallback, quizDiscussionFallback } from '../fallbacks/quizEval';
import { isStemTopic } from '../stem';

const INVALID_BODY = 'بيانات الطلب غير مكتملة.';
const MAX_MATERIAL_CONTEXT = 2000;

/**
 * POST /api/quiz/evaluate-answer
 *
 * Explains a student's answer to one multiple-choice question. The verdict is fixed by
 * `correctAnswerIndex`; Gemini only supplies the explanation and feedback points.
 *
 * Body:
 *   question            – QuizQuestion object (question, options, correctAnswerIndex, explanation)
 *   studentAnswerIndex  – the option index the student selected
 *   concept             – { name, summary } of the concept being tested
 *   materialContext?    – short excerpt of the source material (STEM detection only)
 */
export const handleEvaluateQuizAnswer = async (req: Request, res: Response) => {
  const valid = validateQuizAnswerBody(req.body);
  if (!valid.ok || !req.body?.concept) {
    return res.status(400).json({ error: INVALID_BODY });
  }

  try {
    const { question, studentAnswerIndex } = valid;
    const { concept } = req.body;
    const materialContext =
      typeof req.body.materialContext === 'string' ? req.body.materialContext.slice(0, MAX_MATERIAL_CONTEXT) : '';

    const conceptName = typeof concept?.name === 'string' && concept.name ? concept.name : 'المفهوم المدروس';
    const conceptSummary = typeof concept?.summary === 'string' ? concept.summary : '';
    const isCorrect = studentAnswerIndex === question.correctAnswerIndex;

    const isStem = isStemTopic(conceptName, conceptSummary, question.question, materialContext);

    const prompt = buildQuizEvalPrompt({
      question: question.question,
      questionOptions: question.options,
      correctAnswerIndex: question.correctAnswerIndex,
      correctOptionText: question.options[question.correctAnswerIndex],
      studentAnswerIndex,
      studentOptionText: question.options[studentAnswerIndex],
      questionExplanation: question.explanation,
      conceptName,
      conceptSummary,
      isStem,
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizEvalSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed?.overall_assessment !== 'string' || !parsed.overall_assessment.trim()) {
      return res.json(quizEvalFallback(req.body));
    }

    return res.json(normalizeQuizEvaluation(parsed, isCorrect));
  } catch (err: any) {
    return handleModelFailure(res, 'quiz-evaluate-answer', err, () => quizEvalFallback(req.body));
  }
};

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
 *   previousEvaluation  – the evaluation returned by /api/quiz/evaluate-answer
 *   conversationHistory – earlier turns, NOT including newMessage
 *   newMessage          – the student's latest message
 */
export const handleQuizDiscuss = async (req: Request, res: Response) => {
  const valid = validateQuizAnswerBody(req.body);
  const discussion = sanitizeDiscussion(req.body);
  if (!valid.ok || !discussion.ok) {
    return res.status(400).json({ error: INVALID_BODY });
  }

  try {
    const { question, studentAnswerIndex } = valid;
    const { concept, previousEvaluation } = req.body;
    const conceptName = typeof concept?.name === 'string' && concept.name ? concept.name : 'المفهوم المدروس';
    const isCorrect = studentAnswerIndex === question.correctAnswerIndex;

    const isStem = isStemTopic(conceptName, concept?.summary, question.question);

    const prompt = buildQuizDiscussionPrompt({
      question: question.question,
      correctOptionText: question.options[question.correctAnswerIndex],
      studentOptionText: question.options[studentAnswerIndex],
      isCorrect,
      previousEvaluation: {
        overall_assessment:
          typeof previousEvaluation?.overall_assessment === 'string'
            ? previousEvaluation.overall_assessment.slice(0, 1500)
            : '',
        explanation:
          typeof previousEvaluation?.explanation === 'string' ? previousEvaluation.explanation.slice(0, 3000) : '',
      },
      conversationHistory: discussion.history,
      newMessage: discussion.newMessage,
      conceptName,
      isStem,
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizDiscussionSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed?.reply !== 'string' || !parsed.reply.trim()) {
      return res.json(quizDiscussionFallback(req.body));
    }

    return res.json({ reply: parsed.reply });
  } catch (err: any) {
    return handleModelFailure(res, 'quiz-discuss', err, () => quizDiscussionFallback(req.body));
  }
};
