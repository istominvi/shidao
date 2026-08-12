import {
  BadgeCheck,
  ClipboardCheck,
  FolderOpen,
  History,
  Info,
  ListChecks,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";

export type CourseWorkspaceSurface =
  "lessons" | "about" | "materials" | "history" | "attestation";

export type LessonAuthoringSurface =
  "plan" | "student" | "homework" | "materials" | "history";

export const COURSE_WORKSPACE_TABS = [
  { value: "lessons", label: "Уроки", icon: ListChecks },
  { value: "about", label: "О курсе", icon: Info },
  { value: "materials", label: "Материалы", icon: FolderOpen },
  { value: "history", label: "История", icon: History },
] as const satisfies ReadonlyArray<{
  value: CourseWorkspaceSurface;
  label: string;
  icon: LucideIcon;
}>;

export const EDUCATOR_COURSE_WORKSPACE_TABS = [
  { value: "lessons", label: "Уроки", icon: ListChecks },
  { value: "about", label: "О курсе", icon: Info },
  { value: "materials", label: "Материалы", icon: FolderOpen },
  { value: "attestation", label: "Аттестация", icon: BadgeCheck },
] as const satisfies ReadonlyArray<{
  value: CourseWorkspaceSurface;
  label: string;
  icon: LucideIcon;
}>;

export function courseWorkspaceTabs(educatorCourse: boolean) {
  return educatorCourse
    ? EDUCATOR_COURSE_WORKSPACE_TABS
    : COURSE_WORKSPACE_TABS;
}

export const LESSON_WORKSPACE_TABS = [
  { value: "plan", label: "План", icon: ListChecks },
  { value: "student", label: "Экран ученика", icon: MonitorPlay },
  { value: "homework", label: "Домашнее задание", icon: ClipboardCheck },
  { value: "materials", label: "Материалы", icon: FolderOpen },
  { value: "history", label: "История", icon: History },
] as const satisfies ReadonlyArray<{
  value: LessonAuthoringSurface;
  label: string;
  icon: LucideIcon;
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
