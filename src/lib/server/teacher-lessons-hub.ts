import { toLessonWorkspaceRoute } from "../auth";
import type { ScheduledLesson } from "../lesson-content";
import type { AccessResolution } from "./access-policy";
import {
  createScheduledLessonAdmin,
  getClassDisplayNameByIdAdmin,
  getMethodologyLessonByIdAdmin,
  listAssignedClassIdsForTeacherAdmin,
  listMethodologyLessonsCatalogAdmin,
  listScheduledLessonsForClassesAdmin,
  type CreateScheduledLessonAdminInput,
} from "./lesson-content-repository";
import { canAccessTeacherLessonWorkspace } from "./teacher-lesson-workspace";

const allowedFormats = ["online", "offline"] as const;

export type TeacherLessonHubCard = {
  scheduledLessonId: string;
  title: string;
  methodologyTitle: string | null;
  classLabel: string;
  dateTimeLabel: string;
  formatLabel: "Онлайн" | "Офлайн";
  statusLabel: string;
  runtimeNotesSummary: string;
  workspaceHref: string;
};

export type TeacherLessonsHubReadModel = {
  upcoming: TeacherLessonHubCard[];
  past: TeacherLessonHubCard[];
  classOptions: Array<{ id: string; label: string }>;
  methodologyOptions: Array<{ id: string; label: string }>;
};

type TeacherLessonsHubDeps = {
  listAssignedClassIdsForTeacher: typeof listAssignedClassIdsForTeacherAdmin;
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  getClassDisplayNameById: typeof getClassDisplayNameByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  listMethodologyLessonsCatalog: typeof listMethodologyLessonsCatalogAdmin;
  createScheduledLesson: typeof createScheduledLessonAdmin;
  assertTeacherAssignedToClass: (teacherId: string, classId: string) => Promise<void>;
};

async function assertTeacherAssignedToClassAdminDefault(
  teacherId: string,
  classId: string,
) {
  const { assertTeacherAssignedToClassAdmin } = await import("./supabase-admin");
  await assertTeacherAssignedToClassAdmin(teacherId, classId);
}

const defaultDeps: TeacherLessonsHubDeps = {
  listAssignedClassIdsForTeacher: listAssignedClassIdsForTeacherAdmin,
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  getClassDisplayNameById: getClassDisplayNameByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  listMethodologyLessonsCatalog: listMethodologyLessonsCatalogAdmin,
  createScheduledLesson: createScheduledLessonAdmin,
  assertTeacherAssignedToClass: assertTeacherAssignedToClassAdminDefault,
};

function formatStatus(status: ScheduledLesson["runtimeShell"]["runtimeStatus"]) {
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

function cleanText(text: string | null | undefined) {
  return text?.trim() || "";
}

function buildMethodologyOptionLabel(lesson: {
  methodologyTitle: string | null;
  title: string;
  moduleIndex: number;
  unitIndex: number | null;
  lessonIndex: number;
}) {
  const position = `Модуль ${lesson.moduleIndex} · Урок ${lesson.lessonIndex}${lesson.unitIndex ? ` · Раздел ${lesson.unitIndex}` : ""}`;
  const methodologyLine = lesson.methodologyTitle?.trim()
    ? `${lesson.methodologyTitle} · `
    : "";

  return `${methodologyLine}${position} · ${lesson.title}`;
}

function mapLessonsToCards(input: {
  lessons: ScheduledLesson[];
  classNameById: Record<string, string | null>;
  methodologyTitleById: Record<string, string | null>;
}): TeacherLessonHubCard[] {
  return input.lessons.map((lesson) => {
    const classLabel =
      input.classNameById[lesson.runtimeShell.classId]?.trim() || "Группа";
    const methodologyTitle =
      input.methodologyTitleById[lesson.methodologyLessonId]?.trim() || null;

    return {
      scheduledLessonId: lesson.id,
      title: cleanText(methodologyTitle) || "Занятие",
      methodologyTitle,
      classLabel,
      dateTimeLabel: formatDateTime(lesson.runtimeShell.startsAt),
      formatLabel: lesson.runtimeShell.format === "online" ? "Онлайн" : "Офлайн",
      statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
      runtimeNotesSummary: cleanText(lesson.runtimeShell.runtimeNotesSummary),
      workspaceHref: toLessonWorkspaceRoute(lesson.id),
    };
  });
}

export function canAccessTeacherLessonsHub(resolution: AccessResolution) {
  return canAccessTeacherLessonWorkspace(resolution);
}

export function assertTeacherLessonsHubMutationAccess(
  resolution: AccessResolution,
): { teacherId: string } {
  if (
    resolution.status !== "adult-with-profile" ||
    !canAccessTeacherLessonsHub(resolution)
  ) {
    throw new Error("Только профиль преподавателя может планировать занятия.");
  }

  const teacherId = resolution.context.teacher?.id;
  if (!teacherId) {
    throw new Error("Профиль преподавателя не найден.");
  }

  return { teacherId };
}

export async function getTeacherLessonsHub(
  input: { teacherId: string; nowIso?: string },
  deps: TeacherLessonsHubDeps = defaultDeps,
): Promise<TeacherLessonsHubReadModel> {
  const classIds = await deps.listAssignedClassIdsForTeacher(input.teacherId);
  const [scheduledLessons, methodologyOptions] = await Promise.all([
    deps.listScheduledLessonsForClasses(classIds),
    deps.listMethodologyLessonsCatalog(),
  ]);

  const uniqueClassIds = Array.from(
    new Set(scheduledLessons.map((lesson) => lesson.runtimeShell.classId)),
  );
  const uniqueMethodologyLessonIds = Array.from(
    new Set(scheduledLessons.map((lesson) => lesson.methodologyLessonId)),
  );

  const [classNameEntries, methodologyEntries] = await Promise.all([
    Promise.all(
      uniqueClassIds.map(async (classId) => [
        classId,
        await deps.getClassDisplayNameById(classId),
      ] as const),
    ),
    Promise.all(
      uniqueMethodologyLessonIds.map(async (methodologyLessonId) => {
        const methodologyLesson = await deps.getMethodologyLessonById(
          methodologyLessonId,
        );
        return [methodologyLessonId, methodologyLesson?.methodologyTitle ?? null] as const;
      }),
    ),
  ]);

  const classNameById = Object.fromEntries(classNameEntries);
  const methodologyTitleById = Object.fromEntries(methodologyEntries);

  const now = Date.parse(input.nowIso ?? new Date().toISOString());

  const upcomingLessons = scheduledLessons
    .filter((lesson) => Date.parse(lesson.runtimeShell.startsAt) >= now)
    .sort(
      (a, b) =>
        Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt),
    );

  const pastLessons = scheduledLessons
    .filter((lesson) => Date.parse(lesson.runtimeShell.startsAt) < now)
    .sort(
      (a, b) =>
        Date.parse(b.runtimeShell.startsAt) - Date.parse(a.runtimeShell.startsAt),
    );

  return {
    upcoming: mapLessonsToCards({
      lessons: upcomingLessons,
      classNameById,
      methodologyTitleById,
    }),
    past: mapLessonsToCards({
      lessons: pastLessons,
      classNameById,
      methodologyTitleById,
    }),
    classOptions: classIds.map((classId) => ({
      id: classId,
      label: classNameById[classId]?.trim() || "Группа",
    })),
    methodologyOptions: methodologyOptions.map((lesson) => ({
      id: lesson.id,
      label: buildMethodologyOptionLabel(lesson),
    })),
  };
}

export function parseCreateScheduledLessonFormData(
  formData: FormData,
): CreateScheduledLessonAdminInput {
  const allowedKeys = new Set([
    "classId",
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

  const classId = cleanText(formData.get("classId") as string | null);
  const methodologyLessonId = cleanText(
    formData.get("methodologyLessonId") as string | null,
  );
  const date = cleanText(formData.get("date") as string | null);
  const time = cleanText(formData.get("time") as string | null);
  const formatValue = cleanText(formData.get("format") as string | null);

  if (!classId) {
    throw new Error("Выберите группу для занятия.");
  }

  if (!methodologyLessonId) {
    throw new Error("Выберите методологический урок.");
  }

  if (!date || !time) {
    throw new Error("Укажите дату и время занятия.");
  }

  if (!allowedFormats.includes(formatValue as (typeof allowedFormats)[number])) {
    throw new Error("Формат занятия должен быть online или offline.");
  }

  const startsAt = `${date}T${time}:00Z`;
  if (Number.isNaN(Date.parse(startsAt))) {
    throw new Error("Дата или время занятия указаны неверно.");
  }

  if (formatValue === "online") {
    const meetingLink = cleanText(formData.get("meetingLink") as string | null);
    if (!meetingLink) {
      throw new Error("Для онлайн-формата нужна ссылка на встречу.");
    }

    return {
      classId,
      methodologyLessonId,
      startsAt,
      format: "online",
      meetingLink,
    };
  }

  const place = cleanText(formData.get("place") as string | null);
  if (!place) {
    throw new Error("Для офлайн-формата укажите место проведения.");
  }

  return {
    classId,
    methodologyLessonId,
    startsAt,
    format: "offline",
    place,
  };
}

export async function createTeacherScheduledLesson(
  input: { teacherId: string; payload: CreateScheduledLessonAdminInput },
  deps: TeacherLessonsHubDeps = defaultDeps,
) {
  await deps.assertTeacherAssignedToClass(input.teacherId, input.payload.classId);
  return deps.createScheduledLesson(input.payload);
}
