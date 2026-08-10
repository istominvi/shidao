export type CourseWorkspaceSurface =
  "lessons" | "about" | "materials" | "history";

export type LessonAuthoringSurface =
  "plan" | "student" | "homework" | "materials" | "history";

export const COURSE_WORKSPACE_TABS = [
  { value: "lessons", label: "Уроки" },
  { value: "about", label: "О курсе" },
  { value: "materials", label: "Материалы" },
  { value: "history", label: "История" },
] as const satisfies ReadonlyArray<{
  value: CourseWorkspaceSurface;
  label: string;
}>;

export const LESSON_WORKSPACE_TABS = [
  { value: "plan", label: "План" },
  { value: "student", label: "Экран ученика" },
  { value: "homework", label: "Домашнее задание" },
  { value: "materials", label: "Материалы" },
  { value: "history", label: "История" },
] as const satisfies ReadonlyArray<{
  value: LessonAuthoringSurface;
  label: string;
}>;

export type CourseWorkspaceNavigation = {
  courseSurface: CourseWorkspaceSurface;
  selectedLessonId: string | null;
  lessonSurface: LessonAuthoringSurface;
};

export function createCourseWorkspaceNavigation(): CourseWorkspaceNavigation {
  return {
    courseSurface: "lessons",
    selectedLessonId: null,
    lessonSurface: "plan",
  };
}

export function openCourseWorkspaceLesson(
  current: CourseWorkspaceNavigation,
  lessonId: string,
): CourseWorkspaceNavigation {
  return {
    ...current,
    courseSurface: "lessons",
    selectedLessonId: lessonId,
    lessonSurface: "plan",
  };
}

export function returnToCourseWorkspace(
  current: CourseWorkspaceNavigation,
): CourseWorkspaceNavigation {
  return {
    ...current,
    courseSurface: "lessons",
    selectedLessonId: null,
    lessonSurface: "plan",
  };
}

export function reconcileCourseWorkspaceNavigation(
  current: CourseWorkspaceNavigation,
  lessonIds: ReadonlyArray<string>,
): CourseWorkspaceNavigation {
  if (
    current.selectedLessonId === null ||
    lessonIds.includes(current.selectedLessonId)
  ) {
    return current;
  }

  return returnToCourseWorkspace(current);
}

export function formatLessonWorkspaceTitle(
  position: number,
  title: string,
): string {
  return `Урок ${position}. ${title}`;
}
