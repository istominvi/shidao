import { getScheduledLessonByIdAdmin, listStudentsForClassesAdmin } from "./lesson-content-repository";
import {
  createScheduledHomeworkAssignmentAdmin,
  createStudentHomeworkAssignmentsAdmin,
  getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonIdAdmin,
  isHomeworkSchemaReadyAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  updateStudentHomeworkReviewAdmin,
} from "./homework-repository";
import type { AccessResolution } from "./access-policy";
import { canAccessTeacherLessonWorkspace } from "./teacher-lesson-workspace";

export type TeacherHomeworkRosterItem = {
  studentId: string;
  studentName: string;
  login: string | null;
  assigned: boolean;
  statusLabel: string;
  submissionText: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  studentHomeworkAssignmentId: string | null;
};

export type TeacherLessonHomeworkReadModel = {
  schemaReady: boolean;
  definition: {
    id: string;
    title: string;
    instructions: string;
    materialLinks: string[];
    answerFormatHint?: string;
  } | null;
  assignment: {
    id: string;
    dueAt: string | null;
    recipientMode: "all" | "selected";
    issuedAt: string;
  } | null;
  roster: TeacherHomeworkRosterItem[];
};

function statusLabel(status: "assigned" | "submitted" | "reviewed" | "needs_revision") {
  switch (status) {
    case "assigned":
      return "Назначено";
    case "submitted":
      return "Сдано";
    case "reviewed":
      return "Проверено";
    case "needs_revision":
      return "Нужна доработка";
  }
}

function formatStudentName(student: { fullName: string | null; login: string | null }) {
  return student.fullName?.trim() || student.login?.trim() || "Ученик";
}

export async function getTeacherLessonHomeworkReadModel(scheduledLessonId: string): Promise<TeacherLessonHomeworkReadModel> {
  const scheduledLesson = await getScheduledLessonByIdAdmin(scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  const [schemaReady, definition, assignment, classStudentsByClass] = await Promise.all([
    isHomeworkSchemaReadyAdmin(),
    getMethodologyHomeworkByLessonIdAdmin(scheduledLesson.methodologyLessonId),
    getScheduledHomeworkAssignmentByLessonIdAdmin(scheduledLessonId),
    listStudentsForClassesAdmin([scheduledLesson.runtimeShell.classId]),
  ]);

  const students = classStudentsByClass[scheduledLesson.runtimeShell.classId] ?? [];
  const submissions = assignment
    ? await listStudentHomeworkAssignmentsByScheduledAssignmentAdmin(assignment.id)
    : [];
  const submissionsByStudentId = new Map(submissions.map((item) => [item.studentId, item]));

  return {
    schemaReady,
    definition,
    assignment: assignment
      ? {
          id: assignment.id,
          dueAt: assignment.dueAt,
          recipientMode: assignment.recipientMode,
          issuedAt: assignment.issuedAt,
        }
      : null,
    roster: students.map((student) => {
      const submission = submissionsByStudentId.get(student.id);
      return {
        studentId: student.id,
        studentName: formatStudentName(student),
        login: student.login,
        assigned: Boolean(submission),
        statusLabel: submission ? statusLabel(submission.status) : "Не назначено",
        submissionText: submission?.submissionText ?? null,
        submittedAt: submission?.submittedAt ?? null,
        reviewNote: submission?.reviewNote ?? null,
        reviewedAt: submission?.reviewedAt ?? null,
        studentHomeworkAssignmentId: submission?.id ?? null,
      };
    }),
  };
}

export function assertTeacherHomeworkAccess(resolution: AccessResolution): { teacherId: string } {
  if (
    resolution.status !== "adult-with-profile" ||
    !canAccessTeacherLessonWorkspace(resolution)
  ) {
    throw new Error("Только преподаватель может управлять домашним заданием.");
  }

  const teacherId = resolution.context.teacher?.id;
  if (!teacherId) {
    throw new Error("Профиль преподавателя не найден.");
  }

  return { teacherId };
}

export async function issueHomeworkForScheduledLesson(input: {
  scheduledLessonId: string;
  teacherId: string;
  recipientMode: "all" | "selected";
  selectedStudentIds: string[];
  dueAt: string | null;
}) {
  const scheduledLesson = await getScheduledLessonByIdAdmin(input.scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  const [schemaReady, definition, existingAssignment, classStudentsByClass] = await Promise.all([
    isHomeworkSchemaReadyAdmin(),
    getMethodologyHomeworkByLessonIdAdmin(scheduledLesson.methodologyLessonId),
    getScheduledHomeworkAssignmentByLessonIdAdmin(input.scheduledLessonId),
    listStudentsForClassesAdmin([scheduledLesson.runtimeShell.classId]),
  ]);

  if (!schemaReady) {
    throw new Error("Схема БД не обновлена: примените миграции homework-runtime-layer.");
  }

  if (!definition) {
    throw new Error("Для этого урока методики пока не задано домашнее задание.");
  }

  if (existingAssignment) {
    throw new Error("Домашнее задание уже выдано для этого занятия.");
  }

  const classStudents = classStudentsByClass[scheduledLesson.runtimeShell.classId] ?? [];
  const classStudentIds = new Set(classStudents.map((student) => student.id));
  const recipients =
    input.recipientMode === "all"
      ? classStudents.map((student) => student.id)
      : Array.from(new Set(input.selectedStudentIds.filter((id) => classStudentIds.has(id))));

  if (recipients.length === 0) {
    throw new Error("Выберите хотя бы одного ученика для выдачи задания.");
  }

  const assignment = await createScheduledHomeworkAssignmentAdmin({
    scheduledLessonId: input.scheduledLessonId,
    methodologyHomeworkId: definition.id,
    assignedByTeacherId: input.teacherId,
    recipientMode: input.recipientMode,
    dueAt: input.dueAt,
  });

  await createStudentHomeworkAssignmentsAdmin(
    recipients.map((studentId) => ({
      scheduledHomeworkAssignmentId: assignment.id,
      studentId,
    })),
  );

  return assignment;
}

export async function reviewStudentHomeworkSubmission(input: {
  scheduledLessonId: string;
  studentHomeworkAssignmentId: string;
  status: "reviewed" | "needs_revision";
  reviewNote: string;
}) {
  const assignment = await getScheduledHomeworkAssignmentByLessonIdAdmin(input.scheduledLessonId);
  if (!assignment) {
    throw new Error("Домашнее задание для урока ещё не выдано.");
  }

  const submissions = await listStudentHomeworkAssignmentsByScheduledAssignmentAdmin(assignment.id);
  const target = submissions.find((item) => item.id === input.studentHomeworkAssignmentId);

  if (!target) {
    throw new Error("Отправка ученика не найдена.");
  }

  if (target.status === "assigned") {
    throw new Error("Ученик ещё не отправил домашнее задание.");
  }

  return updateStudentHomeworkReviewAdmin({
    studentHomeworkAssignmentId: target.id,
    status: input.status,
    reviewNote: input.reviewNote.trim() || null,
    reviewedAt: new Date().toISOString(),
  });
}
