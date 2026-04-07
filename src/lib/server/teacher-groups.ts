import { ROUTES, toGroupRoute, toLessonWorkspaceRoute } from "../auth";
import type { AccessResolution } from "./access-policy";
import {
  getMethodologyLessonByIdAdmin,
  listScheduledLessonsForClassesAdmin,
  listStudentsForClassesAdmin,
  listTeacherClassesAdmin,
} from "./lesson-content-repository";
import { canAccessTeacherLessonWorkspace } from "./teacher-lesson-workspace";

export type TeacherGroupListItem = {
  id: string;
  label: string;
  studentCount: number;
  upcomingLessonCount: number;
  nextLessonLabel: string | null;
  assignedMethodologyTitle: string | null;
  href: string;
};

export type TeacherGroupsIndexReadModel = {
  groups: TeacherGroupListItem[];
};

export type TeacherDashboardReadModel = {
  groups: TeacherGroupListItem[];
  upcomingLessons: Array<{
    id: string;
    title: string;
    groupLabel: string;
    dateTimeLabel: string;
    href: string;
  }>;
};

export type TeacherGroupOverviewReadModel = {
  group: TeacherGroupListItem;
  students: Array<{ id: string; displayName: string }>;
  upcomingLessons: Array<{
    id: string;
    title: string;
    dateTimeLabel: string;
    statusLabel: string;
    href: string;
  }>;
  recentLessons: Array<{
    id: string;
    title: string;
    dateTimeLabel: string;
    statusLabel: string;
    href: string;
  }>;
};

type TeacherGroupsDeps = {
  listTeacherClasses: typeof listTeacherClassesAdmin;
  listStudentsForClasses: typeof listStudentsForClassesAdmin;
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
};

const defaultDeps: TeacherGroupsDeps = {
  listTeacherClasses: listTeacherClassesAdmin,
  listStudentsForClasses: listStudentsForClassesAdmin,
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
};

function formatDateTime(startsAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(startsAt))
    .replace(",", " ·");
}

function formatStatus(status: string) {
  switch (status) {
    case "planned":
      return "Запланировано";
    case "in_progress":
      return "Идёт занятие";
    case "completed":
      return "Проведено";
    case "cancelled":
      return "Отменено";
    default:
      return status;
  }
}

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export function canAccessTeacherGroups(resolution: AccessResolution) {
  return canAccessTeacherLessonWorkspace(resolution);
}

export function assertTeacherGroupsAccess(
  resolution: AccessResolution,
): { teacherId: string } {
  if (
    resolution.status !== "adult-with-profile" ||
    !canAccessTeacherGroups(resolution)
  ) {
    throw new Error("Только профиль преподавателя может открывать группы.");
  }

  const teacherId = resolution.context.teacher?.id;
  if (!teacherId) {
    throw new Error("Профиль преподавателя не найден.");
  }

  return { teacherId };
}

async function buildTeacherGroupsSnapshot(
  input: { teacherId: string; nowIso?: string },
  deps: TeacherGroupsDeps,
) {
  const classes = await deps.listTeacherClasses(input.teacherId);
  const classIds = classes.map((item) => item.id);
  const [studentsByClass, lessons] = await Promise.all([
    deps.listStudentsForClasses(classIds),
    deps.listScheduledLessonsForClasses(classIds),
  ]);

  const methodologyIds = Array.from(
    new Set(lessons.map((lesson) => lesson.methodologyLessonId)),
  );
  const methodologyEntries = await Promise.all(
    methodologyIds.map(async (methodologyLessonId) => {
      const lesson = await deps.getMethodologyLessonById(methodologyLessonId);
      return [methodologyLessonId, lesson?.methodologyTitle?.trim() || null] as const;
    }),
  );
  const methodologyTitleById = Object.fromEntries(methodologyEntries);

  const now = Date.parse(input.nowIso ?? new Date().toISOString());

  const groups: TeacherGroupListItem[] = classes.map((group) => {
    const classLessons = lessons
      .filter((lesson) => lesson.runtimeShell.classId === group.id)
      .sort(
        (a, b) =>
          Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt),
      );

    const upcomingLessons = classLessons.filter(
      (lesson) => Date.parse(lesson.runtimeShell.startsAt) >= now,
    );

    const nextLesson = upcomingLessons[0];
    const latestLesson = classLessons[classLessons.length - 1] ?? null;
    const methodologyTitle =
      (nextLesson
        ? methodologyTitleById[nextLesson.methodologyLessonId]
        : latestLesson
          ? methodologyTitleById[latestLesson.methodologyLessonId]
          : null) ?? null;

    return {
      id: group.id,
      label: clean(group.name) || "Группа",
      studentCount: studentsByClass[group.id]?.length ?? 0,
      upcomingLessonCount: upcomingLessons.length,
      nextLessonLabel: nextLesson ? formatDateTime(nextLesson.runtimeShell.startsAt) : null,
      assignedMethodologyTitle: methodologyTitle,
      href: toGroupRoute(group.id),
    };
  });

  const upcomingLessons = lessons
    .filter((lesson) => Date.parse(lesson.runtimeShell.startsAt) >= now)
    .sort(
      (a, b) => Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt),
    )
    .slice(0, 8)
    .map((lesson) => ({
      id: lesson.id,
      title: clean(methodologyTitleById[lesson.methodologyLessonId]) || "Занятие",
      groupLabel:
        groups.find((group) => group.id === lesson.runtimeShell.classId)?.label || "Группа",
      dateTimeLabel: formatDateTime(lesson.runtimeShell.startsAt),
      href: toLessonWorkspaceRoute(lesson.id),
    }));

  return { groups, lessons, studentsByClass, upcomingLessons, methodologyTitleById };
}

export async function getTeacherGroupsIndex(
  input: { teacherId: string; nowIso?: string },
  deps: TeacherGroupsDeps = defaultDeps,
): Promise<TeacherGroupsIndexReadModel> {
  const snapshot = await buildTeacherGroupsSnapshot(input, deps);
  return {
    groups: snapshot.groups.sort((a, b) => a.label.localeCompare(b.label, "ru-RU")),
  };
}

export async function getTeacherDashboardReadModel(
  input: { teacherId: string; nowIso?: string },
  deps: TeacherGroupsDeps = defaultDeps,
): Promise<TeacherDashboardReadModel> {
  const snapshot = await buildTeacherGroupsSnapshot(input, deps);

  return {
    groups: snapshot.groups
      .sort((a, b) => b.upcomingLessonCount - a.upcomingLessonCount)
      .slice(0, 5),
    upcomingLessons: snapshot.upcomingLessons,
  };
}

export async function getTeacherGroupOverview(
  input: { teacherId: string; groupId: string; nowIso?: string },
  deps: TeacherGroupsDeps = defaultDeps,
): Promise<TeacherGroupOverviewReadModel | null> {
  const snapshot = await buildTeacherGroupsSnapshot(
    { teacherId: input.teacherId, nowIso: input.nowIso },
    deps,
  );

  const group = snapshot.groups.find((item) => item.id === input.groupId);
  if (!group) {
    return null;
  }

  const now = Date.parse(input.nowIso ?? new Date().toISOString());

  const scopedLessons = snapshot.lessons
    .filter((lesson) => lesson.runtimeShell.classId === input.groupId)
    .sort(
      (a, b) => Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt),
    );

  const lessonCards = scopedLessons.map((lesson) => ({
    startsAt: lesson.runtimeShell.startsAt,
    id: lesson.id,
    title: clean(snapshot.methodologyTitleById[lesson.methodologyLessonId]) || "Занятие",
    dateTimeLabel: formatDateTime(lesson.runtimeShell.startsAt),
    statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
    href: toLessonWorkspaceRoute(lesson.id),
  }));

  const students = (snapshot.studentsByClass[input.groupId] ?? []).map((student) => ({
    id: student.id,
    displayName: clean(student.fullName) || (clean(student.login) ? `@${clean(student.login)}` : "Ученик"),
  }));

  return {
    group,
    students,
    upcomingLessons: lessonCards
      .filter((lesson) => Date.parse(lesson.startsAt) >= now)
      .map(({ startsAt: _startsAt, ...lesson }) => lesson),
    recentLessons: lessonCards
      .filter((lesson) => Date.parse(lesson.startsAt) < now)
      .reverse()
      .slice(0, 10)
      .map(({ startsAt: _startsAt, ...lesson }) => lesson),
  };
}

export const TEACHER_PRIMARY_NAV = {
  dashboard: ROUTES.dashboard,
  groups: ROUTES.groups,
  lessons: ROUTES.lessons,
} as const;
