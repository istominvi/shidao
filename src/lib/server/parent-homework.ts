import {
  getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  getMethodologyHomeworkByLessonIdAdmin,
} from "./homework-repository";
import {
  getMethodologyLessonByIdAdmin,
  listScheduledLessonsForClassesAdmin,
} from "./lesson-content-repository";

export type ParentHomeworkProjection = Array<{
  studentId: string;
  items: Array<{
    studentId: string;
    scheduledLessonId: string;
    lessonTitle: string;
    homeworkTitle: string;
    dueAt: string | null;
    statusLabel: string;
    assignmentComment: string | null;
    reviewNote: string | null;
    score: number | null;
    maxScore: number | null;
  }>;
}>;

type ParentHomeworkDeps = {
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  getScheduledHomeworkAssignmentByLessonId: typeof getScheduledHomeworkAssignmentByLessonIdAdmin;
  listStudentHomeworkAssignmentsByScheduledAssignment: typeof listStudentHomeworkAssignmentsByScheduledAssignmentAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  getMethodologyHomeworkByLessonId: typeof getMethodologyHomeworkByLessonIdAdmin;
};

const defaultDeps: ParentHomeworkDeps = {
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  getScheduledHomeworkAssignmentByLessonId: getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignment:
    listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  getMethodologyHomeworkByLessonId: getMethodologyHomeworkByLessonIdAdmin,
};

function statusLabel(status: "assigned" | "submitted" | "reviewed" | "needs_revision") {
  if (status === "assigned") return "Назначено";
  if (status === "submitted") return "Сдано";
  if (status === "reviewed") return "Проверено";
  return "Нужна доработка";
}

export async function getParentHomeworkProjection(
  input: {
    children: Array<{ studentId: string; classIds: string[] }>;
  },
  deps: ParentHomeworkDeps = defaultDeps,
): Promise<ParentHomeworkProjection> {
  const classIds = Array.from(new Set(input.children.flatMap((child) => child.classIds)));
  const lessons = await deps.listScheduledLessonsForClasses(classIds);

  const byStudent = new Map<string, ParentHomeworkProjection[number]>();
  for (const child of input.children) {
    byStudent.set(child.studentId, { studentId: child.studentId, items: [] });
  }

  for (const lesson of lessons) {
    const assignment = await deps.getScheduledHomeworkAssignmentByLessonId(lesson.id);
    if (!assignment) continue;

    const [submissions, methodologyLesson, homeworkDefinition] = await Promise.all([
      deps.listStudentHomeworkAssignmentsByScheduledAssignment(assignment.id),
      deps.getMethodologyLessonById(lesson.methodologyLessonId),
      deps.getMethodologyHomeworkByLessonId(lesson.methodologyLessonId),
    ]);

    for (const submission of submissions) {
      const bucket = byStudent.get(submission.studentId);
      if (!bucket) continue;
      bucket.items.push({
        studentId: submission.studentId,
        scheduledLessonId: lesson.id,
        lessonTitle: methodologyLesson?.shell.title ?? "Урок",
        homeworkTitle: homeworkDefinition?.title ?? "Домашнее задание",
        dueAt: assignment.dueAt,
        statusLabel: statusLabel(submission.status),
        assignmentComment: assignment.assignmentComment,
        reviewNote: submission.reviewNote,
        score: submission.autoScore,
        maxScore: submission.autoMaxScore,
      });
    }
  }

  return Array.from(byStudent.values());
}
