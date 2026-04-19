import { toScheduledLessonRoute } from "@/lib/auth";
import {
  getClassByIdAdmin,
  getMethodologyLessonByIdAdmin,
  listClassIdsForStudentAdmin,
  listScheduledLessonsForClassesAdmin,
  listTeacherLabelsForClassIdsAdmin,
} from "@/lib/server/lesson-content-repository";

export type StudentScheduleItem = {
  scheduledLessonId: string;
  lessonTitle: string;
  startsAt: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  statusLabel: string;
  formatLabel: string;
  groupLabel: string;
  teacherLabel: string;
  href: string;
};

function toStatusLabel(status: StudentScheduleItem["status"]) {
  if (status === "in_progress") return "Идёт";
  if (status === "completed") return "Завершено";
  if (status === "cancelled") return "Отменено";
  return "Запланировано";
}

function toFormatLabel(format: "online" | "offline") {
  return format === "online" ? "Онлайн" : "Офлайн";
}

export async function getStudentScheduleReadModel(input: { studentId: string }) {
  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  if (classIds.length === 0) {
    return [] as StudentScheduleItem[];
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
  const lessonTitleByMethodologyLessonId = Object.fromEntries(
    methodologyLessonIds.map((id, index) => [id, methodologyLessons[index]?.shell.title ?? "Урок"]),
  );

  return scheduledLessons
    .map((lesson) => {
      const classId = lesson.runtimeShell.classId;
      const teacherNames = teacherLabelsByClass[classId] ?? [];

      return {
        scheduledLessonId: lesson.id,
        lessonTitle: lessonTitleByMethodologyLessonId[lesson.methodologyLessonId] ?? "Урок",
        startsAt: lesson.runtimeShell.startsAt,
        status: lesson.runtimeShell.runtimeStatus,
        statusLabel: toStatusLabel(lesson.runtimeShell.runtimeStatus),
        formatLabel: toFormatLabel(lesson.runtimeShell.format),
        groupLabel: classLabelById[classId] ?? "Группа",
        teacherLabel: teacherNames.length > 0 ? teacherNames.join(", ") : "Преподаватель не назначен",
        href: toScheduledLessonRoute(lesson.id),
      } satisfies StudentScheduleItem;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
