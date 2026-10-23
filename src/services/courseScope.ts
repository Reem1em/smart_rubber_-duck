import type { CourseScope, SavedCourse } from '../types';

/** The isolation scope for AI calls made inside `course`; undefined when no course is open. */
export function courseScopeOf(course: SavedCourse | null): CourseScope | undefined {
  if (!course) return undefined;
  return {
    courseId: course.id,
    courseTitle: course.title,
    conceptNames: course.concepts.map((c) => c.name),
  };
}
