/**
 * Server-side course store — persistent, per-user course data.
 *
 * Storage layout: data/courses/<userId>.json
 * Each file is a flat JSON array of SavedCourse records owned by that user.
 * Writes are serialized and atomic (temp-file + rename), matching userStore.ts.
 *
 * This is intentionally kept schema-identical to the client-side SavedCourse
 * type so the frontend can consume server responses with zero transformation.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { DATA_DIR } from './userStore';

// Re-declare the minimal shape we need on the server.
// We don't import from src/ to keep the server free of browser-only deps.
export interface ServerCourse {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  /** Extracted concept list — full objects, not just IDs. */
  concepts: unknown[];
  material: unknown;
  createdAt: number;
  updatedAt: number;
  masteredConceptIds: string[];
  gapConceptIds?: string[];
  inProgressConceptIds?: string[];
  roadmap?: unknown;
  activeMilestonePlan?: unknown;
  files?: unknown[];
  /** Extracted slide text per source file (see SlideSource in src/types.ts). */
  slideSources?: unknown[];
  /** Always equals the owning user's `sub`; stored for export/import symmetry. */
  ownerId: string;
}

const COURSES_DIR = path.join(DATA_DIR, 'courses');

function userCoursesPath(userId: string): string {
  // Sanitize: only keep characters that are safe in a file-system path segment.
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(COURSES_DIR, `${safe}.json`);
}

/** In-memory write-chains per user so concurrent writes never corrupt the file. */
const writeChains = new Map<string, Promise<void>>();

async function readUserCourses(userId: string): Promise<Map<string, ServerCourse>> {
  try {
    const raw = JSON.parse(
      await fs.readFile(userCoursesPath(userId), 'utf8')
    ) as { courses?: ServerCourse[] };
    return new Map((raw.courses ?? []).map((c) => [c.id, c]));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.error(`[courseStore] Could not read courses for ${userId}:`, err);
    }
    return new Map();
  }
}

async function persistUserCourses(
  userId: string,
  courses: Map<string, ServerCourse>
): Promise<void> {
  const prev = writeChains.get(userId) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      await fs.mkdir(COURSES_DIR, { recursive: true });
      const filePath = userCoursesPath(userId);
      const tmp = `${filePath}.${process.pid}.tmp`;
      const data = JSON.stringify({ courses: [...courses.values()] }, null, 2);
      await fs.writeFile(tmp, data, 'utf8');
      await fs.rename(tmp, filePath);
    })
    .catch((err) =>
      console.error(`[courseStore] Failed to persist courses for ${userId}:`, err)
    );
  writeChains.set(userId, next);
  return next;
}

// ---- Public API ---------------------------------------------------------- //

export async function listUserCourses(userId: string): Promise<ServerCourse[]> {
  const map = await readUserCourses(userId);
  return [...map.values()].sort(
    (a, b) =>
      b.updatedAt - a.updatedAt ||
      b.createdAt - a.createdAt ||
      (a.title ?? '').localeCompare(b.title ?? '', 'ar')
  );
}

export async function getUserCourse(
  userId: string,
  courseId: string
): Promise<ServerCourse | undefined> {
  const map = await readUserCourses(userId);
  return map.get(courseId);
}

/**
 * Upsert: if the course already exists, the newer copy wins (last-write-wins
 * by `updatedAt` so an older device can never roll back fresh progress).
 */
export async function putUserCourse(
  userId: string,
  course: ServerCourse
): Promise<ServerCourse> {
  const map = await readUserCourses(userId);
  const existing = map.get(course.id);

  // Never roll back progress: keep whichever copy is newer.
  if (existing && existing.updatedAt > course.updatedAt) return existing;

  const next: ServerCourse = { ...course, ownerId: userId, updatedAt: Date.now() };
  map.set(next.id, next);
  await persistUserCourses(userId, map);
  return next;
}

export async function deleteUserCourse(userId: string, courseId: string): Promise<void> {
  const map = await readUserCourses(userId);
  if (!map.has(courseId)) return;
  map.delete(courseId);
  await persistUserCourses(userId, map);
}
