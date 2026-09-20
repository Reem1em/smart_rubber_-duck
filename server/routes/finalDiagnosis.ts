import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
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
    const statedConfidence = diagnosis?.statedConfidence ?? 80;
    const understandingScore = diagnosis?.understandingScore ?? 75;
    const qScore = typeof quizScore === 'number' ? quizScore : 4;
    const qTotal = typeof quizTotal === 'number' && quizTotal > 0 ? quizTotal : 5;
    const quizPercentage = Math.round((qScore / qTotal) * 100);

    const prompt = buildFinalDiagnosisPrompt({ conceptName, statedConfidence, understandingScore, diagnosis, socraticAnswer, transferAnswer, qScore, qTotal, quizPercentage });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: finalDiagnosisSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (typeof parsed.masteryScore === 'number' && parsed.detailedAnalysis) {
      return res.json(parsed);
    }
    throw new Error('Invalid final diagnosis response structure');
  } catch (err: any) {
    console.warn('Fallback triggered for final-diagnosis:', err?.message || err);
    return res.json(finalDiagnosisFallback(req.body));
  }
};
