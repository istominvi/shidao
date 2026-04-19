import { toScheduledLessonRoute } from "@/lib/auth";
import {
  getClassByIdAdmin,
  getMethodologyLessonByIdAdmin,
  listClassIdsForStudentAdmin,
  listScheduledLessonsForClassesAdmin,
  listTeacherLabelsForClassIdsAdmin,
} from "@/lib/server/lesson-content-repository";
import {
  getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
} from "@/lib/server/homework-repository";

const SCHEDULE_DURATION_FALLBACK_MINUTES = 45;

type StudentHomeworkStatus = "assigned" | "submitted" | "reviewed" | "needs_revision";

export type StudentLessonsHubHomeworkMeta = {
  title: string;
  statusLabel: string;
  dueAtLabel: string;
  ctaLabel: string;
};

export type StudentLessonsHubEvent = {
  id: string;
  href: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isoDate: string;
  timeLabel: string;
  timeRangeLabel: string;
  lessonTitle: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  statusLabel: string;
  format: "online" | "offline";
  formatLabel: string;
  groupLabel: string;
  teacherLabel: string;
  homework: StudentLessonsHubHomeworkMeta | null;
};

export type StudentLessonsHubReadModel = {
  events: StudentLessonsHubEvent[];
  nowIso: string;
  defaultDateIso: string;
  totalLessons: number;
  teacherOptions: string[];
  groupOptions: string[];
};

function toStatusLabel(status: StudentLessonsHubEvent["status"]) {
  if (status === "in_progress") return "Идёт";
  if (status === "completed") return "Завершено";
  if (status === "cancelled") return "Отменено";
  return "Запланировано";
}

function toFormatLabel(format: "online" | "offline") {
  return format === "online" ? "Онлайн" : "Офлайн";
}

function toHomeworkStatusLabel(status: StudentHomeworkStatus) {
  if (status === "assigned") return "Ожидает сдачи";
  if (status === "submitted") return "На проверке";
  if (status === "reviewed") return "Проверено";
  return "Нужна доработка";
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60 * 1000).toISOString();
}

function formatTime(startsAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(startsAt));
}

function formatTimeRange(startsAtIso: string, endsAtIso: string) {
  return `${formatTime(startsAtIso)}–${formatTime(endsAtIso)}`;
}

function formatDueDate(dueAt: string | null) {
  if (!dueAt) return "Без срока";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dueAt));
}

export async function getStudentLessonsHubReadModel(input: {
  studentId: string;
}): Promise<StudentLessonsHubReadModel> {
  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);

  if (classIds.length === 0) {
    return {
      events: [],
      nowIso,
      defaultDateIso: todayIso,
      totalLessons: 0,
      teacherOptions: [],
      groupOptions: [],
    };
  }

  const [scheduledLessons, teacherLabelsByClass, classes] = await Promise.all([
    listScheduledLessonsForClassesAdmin(classIds),
    listTeacherLabelsForClassIdsAdmin(classIds),
    Promise.all(classIds.map((classId) => getClassByIdAdmin(classId))),
  ]);

  const classLabelById = Object.fromEntries(
    classes
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => [item.id, item.name?.trim() || "Группа"]),
  );

  const methodologyLessonIds = Array.from(
    new Set(scheduledLessons.map((lesson) => lesson.methodologyLessonId)),
  );
  const methodologyLessons = await Promise.all(
    methodologyLessonIds.map((lessonId) => getMethodologyLessonByIdAdmin(lessonId)),
  );
  const lessonMetaByMethodologyLessonId = Object.fromEntries(
    methodologyLessonIds.map((id, index) => [
      id,
      {
        title: methodologyLessons[index]?.shell.title ?? "Урок",
        durationMinutes:
          methodologyLessons[index]?.shell.estimatedDurationMinutes ??
          SCHEDULE_DURATION_FALLBACK_MINUTES,
      },
    ]),
  ) as Record<string, { title: string; durationMinutes: number }>;

  const homeworkPairs = await Promise.all(
    scheduledLessons.map(async (lesson) => {
      const assignment = await getScheduledHomeworkAssignmentByLessonIdAdmin(lesson.id);
      if (!assignment) return [lesson.id, null] as const;

      const [definition, studentAssignments] = await Promise.all([
        getMethodologyHomeworkByLessonIdAdmin(lesson.methodologyLessonId),
        listStudentHomeworkAssignmentsByScheduledAssignmentAdmin(assignment.id),
      ]);
      const studentAssignment = studentAssignments.find(
        (item) => item.studentId === input.studentId,
      );

      if (!definition || !studentAssignment) {
        return [lesson.id, null] as const;
      }

      return [
        lesson.id,
        {
          title: definition.title,
          statusLabel: toHomeworkStatusLabel(studentAssignment.status),
          dueAtLabel: formatDueDate(assignment.dueAt),
          ctaLabel: "Открыть урок",
        } satisfies StudentLessonsHubHomeworkMeta,
      ] as const;
    }),
  );

  const homeworkByLessonId = new Map(homeworkPairs);

  const events = scheduledLessons
    .map((lesson) => {
      const classId = lesson.runtimeShell.classId;
      const teacherNames = teacherLabelsByClass[classId] ?? [];
      const startsAt = lesson.runtimeShell.startsAt;
      const durationMinutes =
        lessonMetaByMethodologyLessonId[lesson.methodologyLessonId]?.durationMinutes ??
        SCHEDULE_DURATION_FALLBACK_MINUTES;
      const endsAt = addMinutes(startsAt, durationMinutes);

      return {
        id: lesson.id,
        href: toScheduledLessonRoute(lesson.id),
        startsAt,
        endsAt,
        durationMinutes,
        isoDate: startsAt.slice(0, 10),
        timeLabel: formatTime(startsAt),
        timeRangeLabel: formatTimeRange(startsAt, endsAt),
        lessonTitle: lessonMetaByMethodologyLessonId[lesson.methodologyLessonId]?.title ?? "Урок",
        status: lesson.runtimeShell.runtimeStatus,
        statusLabel: toStatusLabel(lesson.runtimeShell.runtimeStatus),
        format: lesson.runtimeShell.format,
        formatLabel: toFormatLabel(lesson.runtimeShell.format),
        groupLabel: classLabelById[classId] ?? "Группа",
        teacherLabel:
          teacherNames.length > 0 ? teacherNames.join(", ") : "Преподаватель не назначен",
        homework: homeworkByLessonId.get(lesson.id) ?? null,
      } satisfies StudentLessonsHubEvent;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const defaultDateIso =
    events.find((event) => Date.parse(event.endsAt) >= Date.parse(nowIso))?.isoDate ??
    events[0]?.isoDate ??
    todayIso;

  return {
    events,
    nowIso,
    defaultDateIso,
    totalLessons: events.length,
    teacherOptions: Array.from(new Set(events.map((event) => event.teacherLabel))).sort(),
    groupOptions: Array.from(new Set(events.map((event) => event.groupLabel))).sort(),
  };
}
