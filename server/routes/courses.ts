/**
 * REST routes for server-side course persistence.
 *
 * All routes require a valid session token.  The user id is always derived
 * from the verified HMAC token — never from the request body or URL params.
 *
 *   GET    /api/courses          → list all courses belonging to the caller
 *   PUT    /api/courses/:id      → upsert one course (create or update)
 *   DELETE /api/courses/:id      → delete one course
 */
import type { Request, Response } from 'express';
import { bearerToken, verifySession } from '../auth/session';
import {
  deleteUserCourse,
  getUserCourse,
  listUserCourses,
  putUserCourse,
  ServerCourse,
} from '../auth/courseStore';

/** Extracts the verified `sub` from the request or sends 401 and returns null. */
function requireSub(req: Request, res: Response): string | null {
  const sub = verifySession(bearerToken(req.headers.authorization));
  if (!sub) {
    res.status(401).json({ error: 'انتهت الجلسة. سجّل دخولك مرة أخرى.' });
    return null;
  }
  return sub;
}

/** GET /api/courses — returns the caller's full course list. */
export const handleListCourses = async (req: Request, res: Response): Promise<void> => {
  const sub = requireSub(req, res);
  if (!sub) return;

  const courses = await listUserCourses(sub);
  res.json({ courses });
};

/** PUT /api/courses/:id — upsert a course that belongs to the caller. */
export const handlePutCourse = async (req: Request, res: Response): Promise<void> => {
  const sub = requireSub(req, res);
  if (!sub) return;

  const courseId = req.params.id;
  if (!courseId || typeof courseId !== 'string') {
    res.status(400).json({ error: 'معرّف المادة مطلوب.' });
    return;
  }

  const body = req.body as Partial<ServerCourse>;
  if (!body || typeof body.id !== 'string' || body.id !== courseId) {
    res.status(400).json({ error: 'معرّف المادة في المسار لا يطابق جسم الطلب.' });
    return;
  }
  if (!Array.isArray(body.concepts) || typeof body.title !== 'string') {
    res.status(400).json({ error: 'بيانات المادة غير مكتملة.' });
    return;
  }

  const course = await putUserCourse(sub, { ...(body as ServerCourse), ownerId: sub });
  res.json({ course });
};

/** DELETE /api/courses/:id — delete one of the caller's courses. */
export const handleDeleteCourse = async (req: Request, res: Response): Promise<void> => {
  const sub = requireSub(req, res);
  if (!sub) return;

  const courseId = req.params.id;
  // Verify ownership before deleting.
  const existing = await getUserCourse(sub, courseId);
  if (!existing) {
    // 404 whether it belongs to someone else or doesn't exist — no info leakage.
    res.status(404).json({ error: 'المادة غير موجودة.' });
    return;
  }

  await deleteUserCourse(sub, courseId);
  res.status(204).end();
};
