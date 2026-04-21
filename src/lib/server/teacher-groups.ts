import { ROUTES, toGroupRoute, toLessonWorkspaceRoute } from "../auth";
import type { AccessResolution } from "./access-policy";
import {
  createScheduledLessonAdmin,
  getMethodologyLessonByIdAdmin,
  listMethodologiesAdmin,
  listMethodologyLessonsByMethodologyAdmin,
  listScheduledLessonsForClassesAdmin,
  listStudentsForClassesAdmin,
  listTeacherClassesAdmin,
  type CreateScheduledLessonAdminInput,
} from "./lesson-content-repository";
import { canAccessTeacherLessonWorkspace } from "./teacher-lesson-workspace";

export type TeacherGroupListItem = {
  id: string;
  label: string;
  studentCount: number;
  upcomingLessonCount: number;
  nextLessonLabel: string | null;
  assignedMethodologyTitle: string | null;
  progressLabel: string;
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
  methodology: {
    assignedMethodologyTitle: string | null;
    assignedMethodologyShortDescription: string | null;
    lessonTotal: number;
  };
  students: Array<{
    id: string;
    displayName: string;
    login: string | null;
    parentId: string | null;
    parentName: string | null;
    parentEmail: string | null;
  }>;
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
  schedule: {
    canSchedule: boolean;
    lessonOptions: Array<{ id: string; label: string }>;
  };
};

type TeacherGroupsDeps = {
  listTeacherClasses: typeof listTeacherClassesAdmin;
  listStudentsForClasses: typeof listStudentsForClassesAdmin;
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  listMethodologies: typeof listMethodologiesAdmin;
  listMethodologyLessonsByMethodology: typeof listMethodologyLessonsByMethodologyAdmin;
  createScheduledLesson: typeof createScheduledLessonAdmin;
  createClassForTeacher: (input: {
    teacherId: string;
    userId: string;
    teacherFullName: string | null;
    name: string;
    methodologyId: string;
  }) => Promise<{ classId: string }>;
  assertTeacherAssignedToClass: (teacherId: string, classId: string) => Promise<void>;
  assertTeacherCanUseClassInActiveSchool?: (input: {
    teacherId: string;
    classId: string;
    activeSchoolId: string;
  }) => Promise<void>;
  getAuthUsersByIds?: (userIds: string[]) => Promise<
    Record<
      string,
      { id: string; email: string | null; user_metadata?: { full_name?: string | null } | null }
    >
  >;
};

async function assertTeacherAssignedToClassAdminDefault(
  teacherId: string,
  classId: string,
) {
  const { assertTeacherAssignedToClassAdmin } = await import("./supabase-admin");
  await assertTeacherAssignedToClassAdmin(teacherId, classId);
}

async function assertTeacherCanUseClassInActiveSchoolAdminDefault(input: {
  teacherId: string;
  classId: string;
  activeSchoolId: string;
}) {
  const { assertTeacherCanUseClassInActiveSchoolAdmin } = await import("./supabase-admin");
  await assertTeacherCanUseClassInActiveSchoolAdmin(input);
}

async function createClassForTeacherAdminDefault(input: {
  teacherId: string;
  userId: string;
  teacherFullName: string | null;
  name: string;
  methodologyId: string;
}) {
  const { createClassForTeacherAdmin } = await import("./supabase-admin");
  return createClassForTeacherAdmin(input);
}

async function getAuthUsersByIdsAdminDefault(userIds: string[]) {
  const { getAuthUsersByIdsAdmin } = await import("./supabase-admin");
  return getAuthUsersByIdsAdmin(userIds);
}

const defaultDeps: TeacherGroupsDeps = {
  listTeacherClasses: listTeacherClassesAdmin,
  listStudentsForClasses: listStudentsForClassesAdmin,
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  listMethodologies: listMethodologiesAdmin,
  listMethodologyLessonsByMethodology: listMethodologyLessonsByMethodologyAdmin,
  createScheduledLesson: createScheduledLessonAdmin,
  createClassForTeacher: createClassForTeacherAdminDefault,
  assertTeacherAssignedToClass: assertTeacherAssignedToClassAdminDefault,
  assertTeacherCanUseClassInActiveSchool: assertTeacherCanUseClassInActiveSchoolAdminDefault,
  getAuthUsersByIds: getAuthUsersByIdsAdminDefault,
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

function buildProgressLabel(completed: number, total: number | null) {
  if (!total || total <= 0) {
    return `${completed} проведено`;
  }

  const percent = Math.min(100, Math.round((completed / total) * 100));
  return `${completed} / ${total} (${percent}%)`;
}

export function parseGroupScopedLessonFormData(
  formData: FormData,
): Omit<CreateScheduledLessonAdminInput, "classId"> {
  const allowedKeys = new Set([
    "methodologyLessonId",
    "date",
    "time",
    "format",
    "meetingLink",
    "place",
  ]);

  for (const key of formData.keys()) {
    if (!allowedKeys.has(key)) {
      throw new Error("Обнаружены неподдерживаемые поля планирования занятия.");
    }
  }

  const methodologyLessonId = clean(
    formData.get("methodologyLessonId") as string | null,
  );
  const date = clean(formData.get("date") as string | null);
  const time = clean(formData.get("time") as string | null);
  const formatValue = clean(formData.get("format") as string | null);

  if (!methodologyLessonId) {
    throw new Error("Выберите урок из назначенной методики.");
  }

  if (!date || !time) {
    throw new Error("Укажите дату и время занятия.");
  }

  if (formatValue !== "online" && formatValue !== "offline") {
    throw new Error("Формат занятия должен быть online или offline.");
  }

  const startsAt = `${date}T${time}:00Z`;
  if (Number.isNaN(Date.parse(startsAt))) {
    throw new Error("Дата или время занятия указаны неверно.");
  }

  if (formatValue === "online") {
    const meetingLink = clean(formData.get("meetingLink") as string | null);
    if (!meetingLink) {
      throw new Error("Для онлайн-формата нужна ссылка на встречу.");
    }

    return {
      methodologyLessonId,
      startsAt,
      format: "online",
      meetingLink,
    };
  }

  const place = clean(formData.get("place") as string | null);
  if (!place) {
    throw new Error("Для офлайн-формата укажите место проведения.");
  }

  return {
    methodologyLessonId,
    startsAt,
    format: "offline",
    place,
  };
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
  input: { teacherId: string; nowIso?: string; activeSchoolId?: string },
  deps: TeacherGroupsDeps,
) {
  const classes = (await deps.listTeacherClasses(input.teacherId)).filter((item) =>
    input.activeSchoolId ? item.schoolId === input.activeSchoolId : true,
  );
  const classIds = classes.map((item) => item.id);
  const [studentsByClass, lessons] = await Promise.all([
    deps.listStudentsForClasses(classIds),
    deps.listScheduledLessonsForClasses(classIds),
  ]);

  const methodologyLessonTotalsEntries = await Promise.all(
    Array.from(
      new Set(
        classes
          .map((item) => item.methodologyId)
          .filter((item): item is string => Boolean(item)),
      ),
    ).map(async (methodologyId) => [
      methodologyId,
      (await deps.listMethodologyLessonsByMethodology(methodologyId)).length,
    ] as const),
  );
  const methodologyLessonTotalsById = Object.fromEntries(
    methodologyLessonTotalsEntries,
  );

  const methodologyLessonTitleById = Object.fromEntries(
    await Promise.all(
      Array.from(new Set(lessons.map((item) => item.methodologyLessonId))).map(
        async (methodologyLessonId) => [
          methodologyLessonId,
          clean((await deps.getMethodologyLessonById(methodologyLessonId))?.shell.title) ||
            "Занятие",
        ] as const,
      ),
    ),
  );

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

    const completedLessons = classLessons.filter(
      (lesson) => lesson.runtimeShell.runtimeStatus === "completed",
    ).length;

    const totalLessons = group.methodologyId
      ? methodologyLessonTotalsById[group.methodologyId] ?? 0
      : null;

    const nextLesson = upcomingLessons[0];

    return {
      id: group.id,
      label: clean(group.name) || "Группа",
      studentCount: studentsByClass[group.id]?.length ?? 0,
      upcomingLessonCount: upcomingLessons.length,
      nextLessonLabel: nextLesson ? formatDateTime(nextLesson.runtimeShell.startsAt) : null,
      assignedMethodologyTitle: clean(group.methodologyTitle) || null,
      progressLabel: buildProgressLabel(completedLessons, totalLessons),
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
      title: methodologyLessonTitleById[lesson.methodologyLessonId] || "Занятие",
      groupLabel:
        groups.find((group) => group.id === lesson.runtimeShell.classId)?.label || "Группа",
      dateTimeLabel: formatDateTime(lesson.runtimeShell.startsAt),
      href: toLessonWorkspaceRoute(lesson.id),
    }));

  return {
    groups,
    classes,
    lessons,
    studentsByClass,
    upcomingLessons,
    methodologyLessonTitleById,
    methodologyLessonTotalsById,
  };
}

export async function createTeacherGroup(input: {
  teacherId: string;
  userId: string;
  teacherFullName: string | null;
  name: string;
  methodologyId: string;
}, deps: TeacherGroupsDeps = defaultDeps) {
  const name = clean(input.name);
  const methodologyId = clean(input.methodologyId);
  if (!name) {
    throw new Error("Укажите название группы.");
  }
  if (!methodologyId) {
    throw new Error("Выберите методику для группы.");
  }
  return deps.createClassForTeacher({
    teacherId: input.teacherId,
    userId: input.userId,
    teacherFullName: input.teacherFullName,
    name,
    methodologyId,
  });
}

export async function createTeacherGroupScopedLesson(input: {
  teacherId: string;
  groupId: string;
  payload: Omit<CreateScheduledLessonAdminInput, "classId">;
  activeSchoolId?: string;
}, deps: TeacherGroupsDeps = defaultDeps) {
  if (input.activeSchoolId) {
    if (!deps.assertTeacherCanUseClassInActiveSchool) {
      throw new Error("Не настроена проверка доступа к группе по активной школе.");
    }
    await deps.assertTeacherCanUseClassInActiveSchool({
      teacherId: input.teacherId,
      classId: input.groupId,
      activeSchoolId: input.activeSchoolId,
    });
  } else {
    await deps.assertTeacherAssignedToClass(input.teacherId, input.groupId);
  }

  const classes = await deps.listTeacherClasses(input.teacherId);
  const group = classes.find((item) => item.id === input.groupId);
  if (!group?.methodologyId) {
    throw new Error("У группы не указана методика. Обратитесь в поддержку.");
  }

  const lessonIds = new Set(
    (await deps.listMethodologyLessonsByMethodology(group.methodologyId)).map(
      (item) => item.id,
    ),
  );

  if (!lessonIds.has(input.payload.methodologyLessonId)) {
    throw new Error("Выбранный урок не принадлежит назначенной методике группы.");
  }

  if (input.payload.format === "online") {
    if (!input.payload.meetingLink) {
      throw new Error("Для онлайн-формата нужна ссылка на встречу.");
    }
    return deps.createScheduledLesson({
      classId: input.groupId,
      methodologyLessonId: input.payload.methodologyLessonId,
      startsAt: input.payload.startsAt,
      format: "online",
      meetingLink: input.payload.meetingLink,
    });
  }

  if (!input.payload.place) {
    throw new Error("Для офлайн-формата укажите место проведения.");
  }
  return deps.createScheduledLesson({
    classId: input.groupId,
    methodologyLessonId: input.payload.methodologyLessonId,
    startsAt: input.payload.startsAt,
    format: "offline",
    place: input.payload.place,
  });
}

export async function getTeacherGroupsIndex(
  input: { teacherId: string; nowIso?: string; activeSchoolId?: string },
  deps: TeacherGroupsDeps = defaultDeps,
): Promise<TeacherGroupsIndexReadModel> {
  const snapshot = await buildTeacherGroupsSnapshot(input, deps);
  return {
    groups: snapshot.groups.sort((a, b) => a.label.localeCompare(b.label, "ru-RU")),
  };
}

export async function getTeacherDashboardReadModel(
  input: { teacherId: string; nowIso?: string; activeSchoolId?: string },
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
  input: { teacherId: string; groupId: string; nowIso?: string; activeSchoolId?: string },
  deps: TeacherGroupsDeps = defaultDeps,
): Promise<TeacherGroupOverviewReadModel | null> {
  const snapshot = await buildTeacherGroupsSnapshot(
    { teacherId: input.teacherId, nowIso: input.nowIso, activeSchoolId: input.activeSchoolId },
    deps,
  );

  const group = snapshot.groups.find((item) => item.id === input.groupId);
  const classRow = snapshot.classes.find((item) => item.id === input.groupId);
  if (!group || !classRow) {
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
    title: snapshot.methodologyLessonTitleById[lesson.methodologyLessonId] || "Занятие",
    dateTimeLabel: formatDateTime(lesson.runtimeShell.startsAt),
    statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
    href: toLessonWorkspaceRoute(lesson.id),
  }));

  const studentRows = snapshot.studentsByClass[input.groupId] ?? [];
  const parentUsersById = deps.getAuthUsersByIds
    ? await deps.getAuthUsersByIds(
      studentRows
        .map((student) => student.parentUserId)
        .filter((id): id is string => Boolean(id)),
    )
    : {};

  const students = studentRows.map((student) => ({
    id: student.id,
    displayName:
      clean(student.fullName) || (clean(student.login) ? `@${clean(student.login)}` : "Ученик"),
    login: clean(student.login) || null,
    parentId: clean(student.parentId) || null,
    parentName: clean(student.parentName) || null,
    parentEmail:
      (student.parentUserId ? clean(parentUsersById[student.parentUserId]?.email) : "") ||
      null,
  }));

  const methodologyOptions = await deps.listMethodologies();
  const methodologyLessonOptions = classRow.methodologyId
    ? await deps.listMethodologyLessonsByMethodology(classRow.methodologyId)
    : [];
  const selectedMethodology = methodologyOptions.find(
    (item) => item.id === classRow.methodologyId,
  );

  return {
    group,
    methodology: {
      assignedMethodologyTitle: clean(classRow.methodologyTitle) || null,
      assignedMethodologyShortDescription:
        selectedMethodology?.shortDescription || null,
      lessonTotal: classRow.methodologyId
        ? snapshot.methodologyLessonTotalsById[classRow.methodologyId] ?? 0
        : 0,
    },
    students,
    upcomingLessons: lessonCards
      .filter((lesson) => Date.parse(lesson.startsAt) >= now)
      .map(({ startsAt: _startsAt, ...lesson }) => lesson),
    recentLessons: lessonCards
      .filter((lesson) => Date.parse(lesson.startsAt) < now)
      .reverse()
      .slice(0, 10)
      .map(({ startsAt: _startsAt, ...lesson }) => lesson),
    schedule: {
      canSchedule: Boolean(classRow.methodologyId),
      lessonOptions: methodologyLessonOptions.map((lesson) => ({
        id: lesson.id,
        label: `Модуль ${lesson.shell.position.moduleIndex} · Урок ${lesson.shell.position.lessonIndex} · ${lesson.shell.title}`,
      })),
    },
  };
}

export const TEACHER_PRIMARY_NAV = {
  dashboard: ROUTES.dashboard,
  groups: ROUTES.groups,
  lessons: ROUTES.lessons,
} as const;
