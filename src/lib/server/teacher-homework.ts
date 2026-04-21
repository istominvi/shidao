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
import { resolveHomeworkQuiz } from "../homework/quiz";
import { notifyHomeworkAssigned, notifyHomeworkReviewed } from "./notification-service";

export type TeacherHomeworkRosterItem = {
  studentId: string;
  studentName: string;
  login: string | null;
  assigned: boolean;
  status: "assigned" | "submitted" | "reviewed" | "needs_revision" | "not_assigned";
  statusLabel: string;
  submissionText: string | null;
  submissionPayload: Record<string, unknown> | null;
  score: number | null;
  maxScore: number | null;
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
    kind: "practice_text" | "quiz_single_choice";
    instructions: string;
    materialLinks: string[];
    answerFormatHint?: string;
    estimatedMinutes?: number;
    questionCount?: number;
    quizDefinition?: Record<string, unknown> | null;
  } | null;
  assignment: {
    id: string;
    dueAt: string | null;
    recipientMode: "all" | "selected";
    assignmentComment: string | null;
    issuedAt: string;
  } | null;
  stats: {
    assignedCount: number;
    submittedCount: number;
    reviewedCount: number;
    needsRevisionCount: number;
    averageScore: number | null;
  };
  roster: TeacherHomeworkRosterItem[];
};

type TeacherHomeworkDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  isHomeworkSchemaReady: typeof isHomeworkSchemaReadyAdmin;
  getMethodologyHomeworkByLessonId: typeof getMethodologyHomeworkByLessonIdAdmin;
  getScheduledHomeworkAssignmentByLessonId: typeof getScheduledHomeworkAssignmentByLessonIdAdmin;
  listStudentsForClasses: typeof listStudentsForClassesAdmin;
  listStudentHomeworkAssignmentsByScheduledAssignment: typeof listStudentHomeworkAssignmentsByScheduledAssignmentAdmin;
  createScheduledHomeworkAssignment: typeof createScheduledHomeworkAssignmentAdmin;
  createStudentHomeworkAssignments: typeof createStudentHomeworkAssignmentsAdmin;
  updateStudentHomeworkReview: typeof updateStudentHomeworkReviewAdmin;
};

const defaultDeps: TeacherHomeworkDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  isHomeworkSchemaReady: isHomeworkSchemaReadyAdmin,
  getMethodologyHomeworkByLessonId: getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonId: getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentsForClasses: listStudentsForClassesAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignment: listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  createScheduledHomeworkAssignment: createScheduledHomeworkAssignmentAdmin,
  createStudentHomeworkAssignments: createStudentHomeworkAssignmentsAdmin,
  updateStudentHomeworkReview: updateStudentHomeworkReviewAdmin,
};

function statusLabel(status: TeacherHomeworkRosterItem["status"]) {
  switch (status) {
    case "assigned":
      return "Назначено";
    case "submitted":
      return "Сдано";
    case "reviewed":
      return "Проверено";
    case "needs_revision":
      return "Нужна доработка";
    case "not_assigned":
      return "Не назначено";
  }
}

function formatStudentName(student: { fullName: string | null; login: string | null }) {
  return student.fullName?.trim() || student.login?.trim() || "Ученик";
}

function toAverageScore(scores: number[]) {
  if (scores.length === 0) return null;
  return Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2));
}

export async function getTeacherLessonHomeworkReadModel(
  scheduledLessonId: string,
  deps: TeacherHomeworkDeps = defaultDeps,
): Promise<TeacherLessonHomeworkReadModel> {
  const scheduledLesson = await deps.getScheduledLessonById(scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  const [schemaReady, definition, assignment, classStudentsByClass] = await Promise.all([
    deps.isHomeworkSchemaReady(),
    deps.getMethodologyHomeworkByLessonId(scheduledLesson.methodologyLessonId),
    deps.getScheduledHomeworkAssignmentByLessonId(scheduledLessonId),
    deps.listStudentsForClasses([scheduledLesson.runtimeShell.classId]),
  ]);

  const students = classStudentsByClass[scheduledLesson.runtimeShell.classId] ?? [];
  const submissions = assignment
    ? await deps.listStudentHomeworkAssignmentsByScheduledAssignment(assignment.id)
    : [];
  const submissionsByStudentId = new Map(submissions.map((item) => [item.studentId, item]));

  const roster = students.map((student) => {
    const submission = submissionsByStudentId.get(student.id);
    const status = submission?.status ?? "not_assigned";
    return {
      studentId: student.id,
      studentName: formatStudentName(student),
      login: student.login,
      assigned: Boolean(submission),
      status,
      statusLabel: statusLabel(status),
      submissionText: submission?.submissionText ?? null,
      submissionPayload: submission?.submissionPayload ?? null,
      score: submission?.autoScore ?? null,
      maxScore: submission?.autoMaxScore ?? null,
      submittedAt: submission?.submittedAt ?? null,
      reviewNote: submission?.reviewNote ?? null,
      reviewedAt: submission?.reviewedAt ?? null,
      studentHomeworkAssignmentId: submission?.id ?? null,
    } satisfies TeacherHomeworkRosterItem;
  });

  const assignedCount = submissions.length;
  const submittedCount = submissions.filter((item) => item.status !== "assigned").length;
  const reviewedCount = submissions.filter((item) => item.status === "reviewed").length;
  const needsRevisionCount = submissions.filter((item) => item.status === "needs_revision").length;
  const averageScore = toAverageScore(
    submissions
      .filter((item) => typeof item.autoScore === "number" && typeof item.autoMaxScore === "number" && item.autoMaxScore > 0)
      .map((item) => (item.autoScore ?? 0) / (item.autoMaxScore ?? 1)),
  );

  const questionCount = definition ? resolveHomeworkQuiz(definition)?.questions.length : undefined;

  return {
    schemaReady,
    definition: definition
      ? {
          id: definition.id,
          title: definition.title,
          kind: definition.kind,
          instructions: definition.instructions,
          materialLinks: definition.materialLinks,
          answerFormatHint: definition.answerFormatHint,
          estimatedMinutes: definition.estimatedMinutes,
          questionCount,
          quizDefinition:
            definition.kind === "quiz_single_choice" ? definition.quiz ?? null : null,
        }
      : null,
    assignment: assignment
      ? {
          id: assignment.id,
          dueAt: assignment.dueAt,
          recipientMode: assignment.recipientMode,
          assignmentComment: assignment.assignmentComment,
          issuedAt: assignment.issuedAt,
        }
      : null,
    stats: {
      assignedCount,
      submittedCount,
      reviewedCount,
      needsRevisionCount,
      averageScore,
    },
    roster,
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
  actorUserId?: string | null;
  recipientMode: "all" | "selected";
  selectedStudentIds: string[];
  dueAt: string | null;
  assignmentComment: string | null;
}, deps: TeacherHomeworkDeps = defaultDeps) {
  const scheduledLesson = await deps.getScheduledLessonById(input.scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  const [schemaReady, definition, existingAssignment, classStudentsByClass] = await Promise.all([
    deps.isHomeworkSchemaReady(),
    deps.getMethodologyHomeworkByLessonId(scheduledLesson.methodologyLessonId),
    deps.getScheduledHomeworkAssignmentByLessonId(input.scheduledLessonId),
    deps.listStudentsForClasses([scheduledLesson.runtimeShell.classId]),
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

  const assignment = await deps.createScheduledHomeworkAssignment({
    scheduledLessonId: input.scheduledLessonId,
    methodologyHomeworkId: definition.id,
    assignedByTeacherId: input.teacherId,
    recipientMode: input.recipientMode,
    dueAt: input.dueAt,
    assignmentComment: input.assignmentComment,
  });

  const studentAssignments = await deps.createStudentHomeworkAssignments(
    recipients.map((studentId) => ({
      scheduledHomeworkAssignmentId: assignment.id,
      studentId,
    })),
  );

  for (const studentAssignment of studentAssignments) {
    try {
      await notifyHomeworkAssigned({
        actorUserId: input.actorUserId ?? null,
        scheduledLessonId: input.scheduledLessonId,
        scheduledHomeworkAssignmentId: assignment.id,
        studentHomeworkAssignmentId: studentAssignment.id,
        studentId: studentAssignment.studentId,
        href: `/lessons/${encodeURIComponent(input.scheduledLessonId)}`,
        homeworkTitle: definition.title,
      });
    } catch (error) {
      console.warn("[notifications] notifyHomeworkAssigned failed", error);
    }
  }

  return assignment;
}

export async function reviewStudentHomeworkSubmission(input: {
  scheduledLessonId: string;
  studentHomeworkAssignmentId: string;
  status: "reviewed" | "needs_revision";
  reviewNote: string;
  actorUserId?: string | null;
}, deps: TeacherHomeworkDeps = defaultDeps) {
  const assignment = await deps.getScheduledHomeworkAssignmentByLessonId(input.scheduledLessonId);
  if (!assignment) {
    throw new Error("Домашнее задание для урока ещё не выдано.");
  }

  const submissions = await deps.listStudentHomeworkAssignmentsByScheduledAssignment(assignment.id);
  const target = submissions.find((item) => item.id === input.studentHomeworkAssignmentId);

  if (!target) {
    throw new Error("Отправка ученика не найдена.");
  }

  if (target.status === "assigned") {
    throw new Error("Ученик ещё не отправил домашнее задание.");
  }

  const updated = await deps.updateStudentHomeworkReview({
    studentHomeworkAssignmentId: target.id,
    status: input.status,
    reviewNote: input.reviewNote.trim() || null,
    reviewedAt: new Date().toISOString(),
  });

  try {
    await notifyHomeworkReviewed({
      actorUserId: input.actorUserId ?? null,
      scheduledLessonId: input.scheduledLessonId,
      scheduledHomeworkAssignmentId: assignment.id,
      studentHomeworkAssignmentId: target.id,
      studentId: target.studentId,
      status: input.status,
      reviewNote: input.reviewNote.trim() || null,
      href: `/lessons/${encodeURIComponent(input.scheduledLessonId)}`,
    });
  } catch (error) {
    console.warn("[notifications] notifyHomeworkReviewed failed", error);
  }

  return updated;
}
