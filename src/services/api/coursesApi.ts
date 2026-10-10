/**
 * Thin API client for the server-side course persistence routes.
 *
 * GET  /api/courses        → fetch all courses owned by the signed-in user
 * PUT  /api/courses/:id    → upsert one course
 * DELETE /api/courses/:id  → delete one course
 *
 * All calls include the session Bearer token automatically via authHeaders().
 * A non-2xx response does not throw — callers get null/false so the app can
 * degrade gracefully to local-only mode when the server is unavailable.
 */
import type { SavedCourse } from '../../types';
import { authHeaders } from '../authSession';

async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // Network failure — caller treats as unavailable.
    return null;
  }
}

/** Fetches the signed-in user's full course list from the server. */
export async function fetchServerCourses(): Promise<SavedCourse[]> {
  const res = await apiFetch('/api/courses');
  if (!res || !res.ok) return [];
  try {
    const body = (await res.json()) as { courses: SavedCourse[] };
    return Array.isArray(body.courses) ? body.courses : [];
  } catch {
    return [];
  }
}

/**
 * Pushes one course to the server (create or update).
 * Returns the server's canonical copy on success, or null on failure.
 */
export async function pushCourseToServer(course: SavedCourse): Promise<SavedCourse | null> {
  const res = await apiFetch(`/api/courses/${encodeURIComponent(course.id)}`, {
    method: 'PUT',
    body: JSON.stringify(course),
  });
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { course: SavedCourse };
    return body.course ?? null;
  } catch {
    return null;
  }
}

/**
 * Deletes a course from the server.
 * Returns true on success (204) or when the course didn't exist (404).
 */
export async function deleteCourseFromServer(courseId: string): Promise<boolean> {
  const res = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
  });
  if (!res) return false;
  return res.ok || res.status === 404;
}
