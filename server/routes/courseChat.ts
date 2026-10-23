import type { Request, Response } from 'express';

import { generateInteractive } from '../gemini';
import { handleModelFailure } from '../routeErrors';
import {
  COURSE_CHAT_SYSTEM_INSTRUCTION,
  buildCourseChatPrompt,
  enforceCitations,
  sanitizeGrounding,
  CourseChatTurn,
} from '../prompts/courseChat';
import { courseChatFallback } from '../fallbacks/courseChat';
import { bearerToken, verifySession } from '../auth/session';
import { getUserCourse } from '../auth/courseStore';
import { ZERO_HALLUCINATION_MANDATE, resolveCourseScope } from '../courseScope';

const normalizeHistory = (raw: unknown): CourseChatTurn[] =>
  Array.isArray(raw)
    ? raw
        .filter((turn: any) => turn && typeof turn.text === 'string')
        .map((turn: any) => ({
          role: turn.role === 'duck' ? 'duck' : 'student',
          text: String(turn.text),
        }))
    : [];

const normalizeFocusConcept = (raw: any) =>
  raw && typeof raw.name === 'string' && raw.name.trim()
    ? {
        name: raw.name.slice(0, 200),
        summary: typeof raw.summary === 'string' ? raw.summary : undefined,
        keyPrinciples: Array.isArray(raw.keyPrinciples)
          ? raw.keyPrinciples.filter((p: unknown): p is string => typeof p === 'string')
          : undefined,
      }
    : undefined;

/**
 * Course-isolated tutor chat.
 *
 * Authorization:
 *   - If a valid session token is present, the course MUST belong to that user
 *     in the server store (or must not exist there at all — guest/local-only).
 *   - If no token is present (guest), the request is allowed through — guest
 *     courses have no server record, so there is nothing to protect.
 *
 * This closes the latent IDOR flagged in the previous audit: req.params.id is
 * now verified, not silently ignored.
 */
export const handleCourseChat = async (req: Request, res: Response) => {
  const courseId = req.params.id;
  if (!courseId) {
    return res.status(400).json({ error: 'معرّف المادة مطلوب.' });
  }

  // Derive identity from the session token — never from the request body.
  const sub = verifySession(bearerToken(req.headers.authorization));

  if (sub) {
    // Signed-in user: verify the course belongs to them if a server record exists.
    const serverCourse = await getUserCourse(sub, courseId).catch(() => undefined);
    if (serverCourse && serverCourse.ownerId !== sub) {
      // Course exists on the server but belongs to someone else.
      return res.status(403).json({ error: 'غير مصرح لك بالوصول إلى هذه المادة.' });
    }
    // If serverCourse is undefined the course is local-only → allow through.
  }
  // No token → guest → allow through (no server record to guard).

  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'اكتب سؤالك أولاً حتى أقدر أشرح لك.' });
    }

    // The URL's course id is authoritative; title and concepts come from the server copy when one exists.
    const scoped = await resolveCourseScope(req, {
      courseId,
      courseTitle: req.body?.courseTitle,
      conceptNames: req.body?.conceptNames,
    });
    if ('error' in scoped || !scoped.scope) {
      return res.status(400).json({ error: 'error' in scoped ? scoped.error : 'معرّف المادة مطلوب.' });
    }

    const grounding = sanitizeGrounding(req.body);
    const prompt = buildCourseChatPrompt({
      courseTitle: scoped.scope.courseTitle,
      conceptNames: scoped.scope.conceptNames,
      focusConcept: normalizeFocusConcept(req.body?.focusConcept),
      history: normalizeHistory(req.body?.history),
      message,
      ...grounding,
    });

    const response = await generateInteractive({
      contents: prompt,
      config: {
        systemInstruction: `${COURSE_CHAT_SYSTEM_INSTRUCTION}\n\n${ZERO_HALLUCINATION_MANDATE}`,
        temperature: 0.4,
        maxOutputTokens: 1000,
      },
    });

    const raw = String(response.text || '').trim();
    if (!raw) throw new Error('Empty chat reply');
    const reply = enforceCitations(raw, grounding.excerpts);

    return res.json({ reply, degraded: false });
  } catch (err: any) {
    return handleModelFailure(res, 'course-chat', err, () => courseChatFallback(req.body));
  }
};
