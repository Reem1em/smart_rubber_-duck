import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import { parseModelJson } from '../modelJson';
import { buildFinalDiagnosisPrompt } from '../prompts/finalDiagnosis';
import { finalDiagnosisSchema } from '../schemas/finalDiagnosis';
import { finalDiagnosisFallback } from '../fallbacks/finalDiagnosis';

export const handleFinalDiagnosis = async (req: Request, res: Response) => {
  try {
    const {
      concept,
      diagnosis,
      socraticAnswer,
      transferChallenge,
      transferAnswer,
      quizScore,
      quizTotal,
    } = req.body;

    const conceptName = concept?.name || 'المفهوم المدروس';
    // Missing signals stay null so the model is never fed invented scores.
    const numOrNull = (v: unknown) => (typeof v === 'number' ? v : null);
    const statedConfidence = numOrNull(diagnosis?.statedConfidence);
    const understandingScore = numOrNull(diagnosis?.understandingScore);
    const quiz = typeof quizScore === 'number' && typeof quizTotal === 'number' && quizTotal > 0
      ? { score: quizScore, total: quizTotal }
      : null;

    const prompt = buildFinalDiagnosisPrompt({ conceptName, statedConfidence, understandingScore, diagnosis, socraticAnswer, transferAnswer, quiz });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: finalDiagnosisSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed.masteryScore === 'number' && parsed.detailedAnalysis) {
      // The schema forces numbers, so pin the initial metrics to what was actually measured.
      parsed.detailedAnalysis.initialConfidence = statedConfidence;
      parsed.detailedAnalysis.initialUnderstanding = understandingScore;
      return res.json(parsed);
    }
    throw new Error('Invalid final diagnosis response structure');
  } catch (err: any) {
    return handleModelFailure(res, 'final-diagnosis', err, () => finalDiagnosisFallback(req.body));
  }
};
