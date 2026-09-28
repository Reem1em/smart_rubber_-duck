/**
 * Local-first storage layer for the "My Courses" (موادي) workspace.
 *
 * Everything lives in the browser's IndexedDB via idb-keyval (pure JS, no native
 * bindings, no login). A course is keyed by the SHA-256 hash of its source
 * content, so re-uploading the same file resolves from cache with zero AI calls.
 */
import { createStore, get, set, del, keys, getMany, UseStore } from 'idb-keyval';

import {
  Concept,
  ConceptStatus,
  CourseFile,
  CourseRoadmap,
  ExamMilestonePlan,
  MaterialInput,
  SavedCourse,
  WorkspaceExport,
} from '../types';

const DB_NAME = 'quakly-workspace';
const STORE_NAME = 'courses';
const EXPORT_VERSION = 1;

let cachedStore: UseStore | null = null;

/**
 * Opens the object store on first use. Deferring it keeps module import safe where
 * IndexedDB is missing (SSR, or a browser in strict private mode).
 */
function courseStoreRef(): UseStore {
  if (!cachedStore) {
    cachedStore = createStore(DB_NAME, STORE_NAME);
  }
  return cachedStore;
}

/** Content hash used as the course id. Falls back to FNV-1a when SubtleCrypto is unavailable. */
export async function hashContent(input: string | ArrayBuffer): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Non-secure context (plain http on a LAN IP): fall through to the sync hash.
    }
  }

  // FNV-1a 32-bit, widened with the byte length to keep collisions unlikely.
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv${h.toString(16).padStart(8, '0')}${bytes.length.toString(16)}`;
}

/** Stable id for a material: hashes the document bytes or the pasted text. */
export async function hashMaterial(material: MaterialInput): Promise<string> {
  if (material.base64Data) return hashContent(material.base64Data);
  if (material.rawText) return hashContent(material.rawText);
  return hashContent(`${material.fileName}:${material.fileSize}`);
}

/** Hashes a File straight from the picker, before it is read into state. */
export async function hashFile(file: File): Promise<string> {
  return hashContent(await file.arrayBuffer());
}

export async function getCourse(id: string): Promise<SavedCourse | undefined> {
  return get<SavedCourse>(id, courseStoreRef());
}

/**
 * Courses a caller may see: guest (unowned) courses always, plus the signed-in
 * user's own. Another account's courses on a shared device stay hidden.
 */
export function isVisibleTo(course: SavedCourse, ownerId: string | null): boolean {
  return !course.ownerId || course.ownerId === ownerId;
}

async function allCourses(): Promise<SavedCourse[]> {
  const allKeys = await keys(courseStoreRef());
  if (allKeys.length === 0) return [];
  return (await getMany<SavedCourse>(allKeys as IDBValidKey[], courseStoreRef())).filter(Boolean);
}

export async function listCourses(ownerId: string | null = null): Promise<SavedCourse[]> {
  const rows = await allCourses();
  // Newest first; tie-break on createdAt then title so same-millisecond writes
  // (import, or two quick uploads) still produce a stable card order.
  return rows
    .filter((course) => isVisibleTo(course, ownerId))
    .sort(
      (a, b) =>
        b.updatedAt - a.updatedAt ||
        b.createdAt - a.createdAt ||
        a.title.localeCompare(b.title, 'ar')
    );
}

export async function putCourse(course: SavedCourse): Promise<SavedCourse> {
  const next = { ...course, updatedAt: Date.now() };
  await set(next.id, next, courseStoreRef());
  return next;
}

export async function deleteCourse(id: string): Promise<void> {
  await del(id, courseStoreRef());
}

/** Creates (or refreshes) the cached workspace for a freshly analyzed material. */
export async function upsertCourseFromMaterial(
  id: string,
  material: MaterialInput,
  concepts: Concept[],
  ownerId: string | null = null
): Promise<SavedCourse> {
  const existing = await getCourse(id);
  const now = Date.now();

  return putCourse({
    id,
    title: courseTitleFrom(material),
    fileName: material.fileName,
    fileSize: material.fileSize,
    fileType: material.fileType,
    concepts,
    material,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    masteredConceptIds: existing?.masteredConceptIds ?? [],
    gapConceptIds: existing?.gapConceptIds ?? [],
    inProgressConceptIds: existing?.inProgressConceptIds ?? [],
    // A syllabus roadmap is keyed to the same document, so re-analyzing keeps it.
    roadmap: existing?.roadmap,
    ownerId: ownerId ?? existing?.ownerId,
  });
}

/**
 * Links every guest course on this device to the account that just signed in,
 * so work done before login follows the student. Returns how many were claimed.
 */
export async function claimUnownedCourses(ownerId: string): Promise<number> {
  const unowned = (await allCourses()).filter((course) => !course.ownerId);
  // set() directly: claiming must not bump updatedAt and reshuffle the card order.
  await Promise.all(unowned.map((course) => set(course.id, { ...course, ownerId }, courseStoreRef())));
  return unowned.length;
}

const without = (list: string[] | undefined, id: string) => (list ?? []).filter((x) => x !== id);
const withId = (list: string[] | undefined, id: string) =>
  (list ?? []).includes(id) ? (list ?? []) : [...(list ?? []), id];

/** Records a concept as mastered (🟢); clears any earlier gap or in-progress flag. */
export async function markConceptMastered(
  courseId: string,
  conceptId: string
): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  if (
    course.masteredConceptIds.includes(conceptId) &&
    !(course.gapConceptIds ?? []).includes(conceptId) &&
    !(course.inProgressConceptIds ?? []).includes(conceptId)
  ) {
    return course;
  }
  return putCourse({
    ...course,
    masteredConceptIds: withId(course.masteredConceptIds, conceptId),
    gapConceptIds: without(course.gapConceptIds, conceptId),
    inProgressConceptIds: without(course.inProgressConceptIds, conceptId),
  });
}

/** Flags a comprehension gap (🔴) found while the student explained the concept aloud. */
export async function markConceptGap(
  courseId: string,
  conceptId: string
): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  return putCourse({
    ...course,
    masteredConceptIds: without(course.masteredConceptIds, conceptId),
    gapConceptIds: withId(course.gapConceptIds, conceptId),
    inProgressConceptIds: without(course.inProgressConceptIds, conceptId),
  });
}

/** Marks a concept as opened but not yet settled (🟡). Never downgrades a mastered concept. */
export async function markConceptInProgress(
  courseId: string,
  conceptId: string
): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  if (
    course.masteredConceptIds.includes(conceptId) ||
    (course.gapConceptIds ?? []).includes(conceptId) ||
    (course.inProgressConceptIds ?? []).includes(conceptId)
  ) {
    return course;
  }
  return putCourse({
    ...course,
    inProgressConceptIds: withId(course.inProgressConceptIds, conceptId),
  });
}

/** Mastery badge for one concept. Mastered wins over a gap, which wins over in-progress. */
export function conceptStatus(course: SavedCourse, conceptId: string | null): ConceptStatus {
  if (!conceptId) return 'not-started';
  if (course.masteredConceptIds.includes(conceptId)) return 'mastered';
  if ((course.gapConceptIds ?? []).includes(conceptId)) return 'gap';
  if ((course.inProgressConceptIds ?? []).includes(conceptId)) return 'in-progress';
  return 'not-started';
}

/** Caches the parsed roadmap on the course so the syllabus is never re-parsed. */
export async function saveRoadmap(
  courseId: string,
  roadmap: CourseRoadmap
): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  return putCourse({ ...course, roadmap });
}

/** Drops the cached roadmap so the student can run the setup wizard again. */
export async function clearRoadmap(courseId: string): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  const { roadmap: _discarded, ...rest } = course;
  return putCourse(rest as SavedCourse);
}

/** Stores the exam the student is sprinting toward, replacing any previous target. */
export async function saveMilestonePlan(
  courseId: string,
  plan: ExamMilestonePlan
): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  return putCourse({ ...course, activeMilestonePlan: plan });
}

export async function clearMilestonePlan(courseId: string): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  const { activeMilestonePlan: _discarded, ...rest } = course;
  return putCourse(rest as SavedCourse);
}

export function courseProgress(course: SavedCourse): number {
  if (course.concepts.length === 0) return 0;
  return Math.round((course.masteredConceptIds.length / course.concepts.length) * 100);
}

/**
 * Appends a new chapter file record to the course and merges its concepts into the
 * aggregated pool. Concepts are tagged with `fileId` via their `chapterOrUnit` field
 * using the pattern "[fileId]::{original chapterOrUnit}" so they can be filtered by file.
 *
 * If the file hash already exists in `course.files`, the call is a no-op and
 * returns `{ duplicate: true }` so the caller can notify the student.
 */
export async function addFileToCourse(
  courseId: string,
  fileRecord: CourseFile,
  newConcepts: Concept[]
): Promise<{ course: SavedCourse; duplicate: boolean }> {
  const course = await getCourse(courseId);
  if (!course) throw new Error('المادة غير موجودة.');

  const existing = (course.files ?? []).find((f) => f.id === fileRecord.id);
  if (existing) return { course, duplicate: true };

  // Tag each new concept so we know which file it came from.
  const taggedConcepts = newConcepts.map((c) => ({
    ...c,
    // Preserve any existing chapterOrUnit inside the tag.
    chapterOrUnit: `${fileRecord.id}::${c.chapterOrUnit || fileRecord.fileName}`,
  }));

  const updated = await putCourse({
    ...course,
    files: [...(course.files ?? []), { ...fileRecord, status: 'ready' }],
    concepts: [...course.concepts, ...taggedConcepts],
  });
  return { course: updated, duplicate: false };
}

/**
 * Removes a chapter file and all concepts sourced from it.
 * Returns the updated course.
 */
export async function removeFileFromCourse(
  courseId: string,
  fileId: string
): Promise<SavedCourse | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;

  const prunedConcepts = course.concepts.filter(
    (c) => !c.chapterOrUnit?.startsWith(`${fileId}::`)
  );
  const prunedIds = new Set(prunedConcepts.map((c) => c.id));

  return putCourse({
    ...course,
    files: (course.files ?? []).filter((f) => f.id !== fileId),
    concepts: prunedConcepts,
    masteredConceptIds: course.masteredConceptIds.filter((id) => prunedIds.has(id)),
    gapConceptIds: (course.gapConceptIds ?? []).filter((id) => prunedIds.has(id)),
    inProgressConceptIds: (course.inProgressConceptIds ?? []).filter((id) => prunedIds.has(id)),
  });
}

/** Strips the file extension so cards show a readable course title. */
function courseTitleFrom(material: MaterialInput): string {
  const base = (material.fileName || 'مادة دراسية').replace(/\.[^.]+$/, '').trim();
  return base || 'مادة دراسية';
}

export async function exportWorkspace(ownerId: string | null = null): Promise<WorkspaceExport> {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    courses: await listCourses(ownerId),
  };
}

/** Merges an exported workspace back in. Returns how many courses were written. */
export async function importWorkspace(payload: unknown, ownerId: string | null = null): Promise<number> {
  const courses = (payload as WorkspaceExport | undefined)?.courses;
  if (!Array.isArray(courses)) {
    throw new Error('ملف المساحة غير صالح: لا يحتوي على قائمة المواد (courses).');
  }

  let written = 0;
  for (const raw of courses) {
    if (!raw || typeof raw.id !== 'string' || !Array.isArray(raw.concepts)) continue;
    const existing = await getCourse(raw.id);
    // Keep whichever copy is newer so an import never rolls back local progress.
    if (existing && existing.updatedAt >= (raw.updatedAt ?? 0)) continue;
    await set(
      raw.id,
      {
        ...raw,
        masteredConceptIds: Array.isArray(raw.masteredConceptIds) ? raw.masteredConceptIds : [],
        gapConceptIds: Array.isArray(raw.gapConceptIds) ? raw.gapConceptIds : [],
        inProgressConceptIds: Array.isArray(raw.inProgressConceptIds)
          ? raw.inProgressConceptIds
          : [],
        createdAt: raw.createdAt ?? Date.now(),
        updatedAt: raw.updatedAt ?? Date.now(),
        // Imported courses belong to whoever imports them.
        ownerId: ownerId ?? undefined,
      } satisfies SavedCourse,
      courseStoreRef()
    );
    written++;
  }
  return written;
}
