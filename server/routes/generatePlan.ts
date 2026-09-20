import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { parseModelJson } from '../modelJson';
import { buildStudyPlanPrompt } from '../prompts/generatePlan';
import { studyPlanSchema } from '../schemas/generatePlan';
import { studyPlanFallback } from '../fallbacks/generatePlan';

export const handleGeneratePlan = async (req: Request, res: Response) => {
  try {
    const { courses, finalExamSchedule, dailyStudyHours, upcomingQuizzes, userExamDates, targetExamDate, extraNotes, rawDocumentText } = req.body;

    const examDatesInput = userExamDates || finalExamSchedule || upcomingQuizzes || '';
    const hoursInput = dailyStudyHours || 3;
    const docText = rawDocumentText || courses || 'المستند الدراسي المرفق';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Server-side check: Validate if explicit targetExamDate is in the past
    if (targetExamDate && targetExamDate.trim()) {
      const parsedTarget = new Date(targetExamDate.trim() + 'T00:00:00');
      if (!isNaN(parsedTarget.getTime())) {
        parsedTarget.setHours(0, 0, 0, 0);
        if (parsedTarget < today) {
          return res.status(400).json({
            error: `التاريخ المحدد (${targetExamDate}) تاريخ قديم ومنقضٍ وغير دقيق! لا يمكن بناء خطة انضباط دراسي لموعد مضى في الماضي. يرجى تحديد تاريخ اختبار مستقبلي.`,
          });
        }
      }
    }

    // Check for ISO or numeric past dates in text: e.g. YYYY-MM-DD
    const dateRegex = /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g;
    let match: RegExpExecArray | null;
    while ((match = dateRegex.exec(examDatesInput)) !== null) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      const parsed = new Date(y, m, d);
      parsed.setHours(0, 0, 0, 0);
      if (parsed < today) {
        const formatted = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return res.status(400).json({
          error: `التاريخ المدخل (${formatted}) تاريخ قديم ومنقضٍ وغير دقيق! يرجى إدخال تاريخ مستقبلي للاختبار لتوليد خطة انضباط واقعية.`,
        });
      }
    }

    // Check for past years: 2020-2025
    const currentYear = today.getFullYear();
    const pastYearRegex = /\b(201\d|202[0-5])\b/g;
    const pastYearMatch = pastYearRegex.exec(examDatesInput);
    if (pastYearMatch && parseInt(pastYearMatch[1], 10) < currentYear) {
      return res.status(400).json({
        error: `السنة المدخلة (${pastYearMatch[1]}) سنة ماضية وغير دقيقة. يرجى تحديد موعد اختبار في السنة الحالية أو القادمة.`,
      });
    }

    const todayStr = today.toISOString().split('T')[0];

    const prompt = buildStudyPlanPrompt({ todayStr, docText, examDatesInput, targetExamDate, hoursInput, extraNotes });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: studyPlanSchema,
      },
    });

    const parsed = parseModelJson(response.text);
    if (parsed.weeklyPlan && Array.isArray(parsed.weeklyPlan)) {
      return res.json(parsed);
    }
    throw new Error('Invalid plan format returned');
  } catch (err: any) {
    console.warn('Fallback triggered for generate-plan:', err?.message || err);
    return res.json(studyPlanFallback(req.body));
  }
};
