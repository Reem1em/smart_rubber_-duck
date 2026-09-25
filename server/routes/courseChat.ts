import type { Request, Response } from 'express';

import { generateWithFallback } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import {
  COURSE_CHAT_SYSTEM_INSTRUCTION,
  buildCourseChatPrompt,
  CourseChatTurn,
} from '../prompts/courseChat';
import { courseChatFallback } from '../fallbacks/courseChat';

const normalizeHistory = (raw: unknown): CourseChatTurn[] =>
  Array.isArray(raw)
    ? raw
        .filter((turn: any) => turn && typeof turn.text === 'string')
        .map((turn: any) => ({
          role: turn.role === 'duck' ? 'duck' : 'student',
          text: String(turn.text),
        }))
    : [];

/**
 * Course-isolated tutor chat. The course id in the path scopes the grounding to
 * that workspace only; history is supplied by the client, which stores it per course.
 */
export const handleCourseChat = async (req: Request, res: Response) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'اكتب سؤالك أولاً حتى أقدر أشرح لك.' });
    }

    const prompt = buildCourseChatPrompt({
      courseTitle: String(req.body?.courseTitle || 'المادة الدراسية'),
      conceptNames: Array.isArray(req.body?.conceptNames)
        ? req.body.conceptNames.map((n: unknown) => String(n)).filter(Boolean)
        : [],
      focusConcept: req.body?.focusConcept,
      history: normalizeHistory(req.body?.history),
      message,
    });

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        systemInstruction: COURSE_CHAT_SYSTEM_INSTRUCTION,
        // Plain prose: no JSON schema, so the turn stays cheap.
        temperature: 0.8,
        maxOutputTokens: 700,
      },
    });

    const reply = String(response.text || '').trim();
    if (!reply) throw new Error('Empty chat reply');

    return res.json({ reply, degraded: false });
  } catch (err: any) {
    return handleModelFailure(res, 'course-chat', err, () => courseChatFallback(req.body));
  }
};
