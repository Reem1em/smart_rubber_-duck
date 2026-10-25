import type { Request, Response } from 'express';

import { generateWithRetry, isQuotaOrRateLimitError } from '../gemini';
import { handleAssessmentFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildSystemPrompt } from '../utils/loadAgent';
import { buildExamAnalysisPrompt, buildGenerateQuestionsPrompt } from '../prompts/generateQuestions';
import { examAnalysisSchema, generatedQuestionsSchema } from '../schemas/generateQuestions';
import {
  parseAnalyzeExamRequest,
  parseGenerateQuestionsRequest,
  verifyExamAnalysis,
  verifyGeneratedQuestions,
} from '../generateQuestions';
import { isStemTopic } from '../stem';

const SYSTEM_PROMPT = buildSystemPrompt('03_GENERATOR.md');

const ANALYZE_TIMEOUT_MS = 60_000;
/** Stays under the API watchdog (170s) with room for the response. */
const GENERATE_TIMEOUT_MS = 120_000;
const STEM_SNIFF_CHARS = 3_000;

const ANALYZE_FAILED = 'تعذر تحليل نموذج الاختبار الآن. يرجى المحاولة مرة أخرى.';
const NO_EXAM_QUESTIONS =
  'لم يُعثر على أسئلة اختبار في الملف المرفوع. تأكد أنه نموذج اختبار أو واجب وليس شرحاً أو ملخصاً.';
const GENERATE_FAILED = 'تعذر بناء أسئلة موثوقة من النموذج ومحتوى المقرر. يرجى المحاولة مرة أخرى.';

/**
 * POST /api/generate-questions/analyze-exam
 * Body: { subjectId, exam: { name, text }, topics: { id, name, summary }[] }
 * Response: ExamAnalysis — real per-topic question counts from the uploaded exam.
 */
export const handleAnalyzeExam = async (req: Request, res: Response) => {
  const parsed = parseAnalyzeExamRequest(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { subjectId, exam, topics } = parsed.request;

  try {
    const response = await generateWithRetry(
      {
        contents: buildExamAnalysisPrompt({ subjectId, exam, topics }),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: examAnalysisSchema,
          temperature: 0,
        },
      },
      ANALYZE_TIMEOUT_MS
    );

    const analysis = verifyExamAnalysis(parseModelJson(response.text).exam_questions, exam, topics);
    if (analysis.examQuestionCount === 0) return res.status(422).json({ error: NO_EXAM_QUESTIONS });
    return res.json(analysis);
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) return handleAssessmentFailure(res, 'analyze-exam', err);
    console.error('[analyze-exam] failed:', err?.message || err);
    return res.status(503).json({ error: ANALYZE_FAILED });
  }
};

/**
 * POST /api/generate-questions
 * Body: { subjectId, difficulty, exam: { name, text } | null, documents: PracticeDocument[],
 *         topics: { id, name, summary, keyPrinciples, count, difficulty? }[] }
 * Response: { questions, coverage, requestedTotal } — coverage reports per-topic shortfalls;
 * there is no fallback, because canned questions would not come from the student's sources.
 */
export const handleGenerateQuestions = async (req: Request, res: Response) => {
  const parsed = parseGenerateQuestionsRequest(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { subjectId, exam, documents, topics } = parsed.request;

  try {
    const isStem = isStemTopic(
      subjectId,
      ...topics.map((t) => `${t.name} ${t.summary}`),
      exam?.text.slice(0, STEM_SNIFF_CHARS),
      ...documents.map((d) => d.text.slice(0, STEM_SNIFF_CHARS))
    );

    const response = await generateWithRetry(
      {
        contents: buildGenerateQuestionsPrompt({ subjectId, exam, documents, topics, isStem }),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: generatedQuestionsSchema,
        },
      },
      GENERATE_TIMEOUT_MS
    );

    const { questions, coverage } = verifyGeneratedQuestions(parseModelJson(response.text).questions, topics, exam);
    if (questions.length === 0) throw new Error('No generated question passed verification');

    return res.json({ questions, coverage, requestedTotal: topics.reduce((s, t) => s + t.count, 0) });
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) return handleAssessmentFailure(res, 'generate-questions', err);
    console.error('[generate-questions] failed:', err?.message || err);
    return res.status(503).json({ error: GENERATE_FAILED });
  }
};
