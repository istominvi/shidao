import {
  listScheduledLessonsForClassesAdmin,
} from "./lesson-content-repository";
import {
  getStudentHomeworkAssignmentByIdAdmin,
  getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  updateStudentHomeworkSubmissionAdmin,
} from "./homework-repository";

export type StudentHomeworkCard = {
  scheduledLessonId: string;
  lessonTitle: string;
  homeworkTitle: string;
  instructions: string;
  dueAt: string | null;
  status: "assigned" | "submitted" | "reviewed" | "needs_revision";
  statusLabel: string;
  studentHomeworkAssignmentId: string;
  submissionText: string | null;
  reviewNote: string | null;
};

function statusLabel(status: StudentHomeworkCard["status"]) {
  switch (status) {
    case "assigned":
      return "Ожидает сдачи";
    case "submitted":
      return "Сдано, ждёт проверки";
    case "reviewed":
      return "Проверено преподавателем";
    case "needs_revision":
      return "Нужна доработка";
  }
}

export async function getStudentHomeworkReadModel(input: {
  studentId: string;
  classIds: string[];
}) {
  const lessons = await listScheduledLessonsForClassesAdmin(input.classIds);
  const cards: StudentHomeworkCard[] = [];

  for (const lesson of lessons) {
    const assignment = await getScheduledHomeworkAssignmentByLessonIdAdmin(lesson.id);
    if (!assignment) continue;

    const [homeworkDefinition, perStudent] = await Promise.all([
      getMethodologyHomeworkByLessonIdAdmin(lesson.methodologyLessonId),
      listStudentHomeworkAssignmentsByScheduledAssignmentAdmin(assignment.id),
    ]);

    const studentAssignment = perStudent.find((item) => item.studentId === input.studentId);
    if (!homeworkDefinition || !studentAssignment) continue;

    cards.push({
      scheduledLessonId: lesson.id,
      lessonTitle: "Домашнее задание по уроку",
      homeworkTitle: homeworkDefinition.title,
      instructions: homeworkDefinition.instructions,
      dueAt: assignment.dueAt,
      status: studentAssignment.status,
      statusLabel: statusLabel(studentAssignment.status),
      studentHomeworkAssignmentId: studentAssignment.id,
      submissionText: studentAssignment.submissionText,
      reviewNote: studentAssignment.reviewNote,
    });
  }

  return cards.sort((a, b) => {
    const aTs = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
    const bTs = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
    return aTs - bTs;
  });
}

export async function submitStudentHomework(input: {
  studentId: string;
  studentHomeworkAssignmentId: string;
  submissionText: string;
}) {
  const normalized = input.submissionText.trim();
  if (!normalized) {
    throw new Error("Добавьте текст ответа перед отправкой.");
  }

  const assignment = await getStudentHomeworkAssignmentByIdAdmin(
    input.studentHomeworkAssignmentId,
  );
  if (!assignment || assignment.studentId !== input.studentId) {
    throw new Error("Домашнее задание не найдено для этого ученика.");
  }

  return updateStudentHomeworkSubmissionAdmin({
    studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
    status: "submitted",
    submissionText: normalized,
    submittedAt: new Date().toISOString(),
  });
}
