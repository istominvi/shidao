import { getScheduledHomeworkAssignmentByLessonIdAdmin, listStudentHomeworkAssignmentsByScheduledAssignmentAdmin } from "./homework-repository";
import { listScheduledLessonsForClassesAdmin } from "./lesson-content-repository";

export type ParentHomeworkProjection = Array<{
  studentId: string;
  items: Array<{
    scheduledLessonId: string;
    dueAt: string | null;
    statusLabel: string;
  }>;
}>;

function statusLabel(status: "assigned" | "submitted" | "reviewed" | "needs_revision") {
  if (status === "assigned") return "Назначено";
  if (status === "submitted") return "Сдано";
  if (status === "reviewed") return "Проверено";
  return "Нужна доработка";
}

export async function getParentHomeworkProjection(input: {
  children: Array<{ studentId: string; classIds: string[] }>;
}): Promise<ParentHomeworkProjection> {
  const classIds = Array.from(new Set(input.children.flatMap((child) => child.classIds)));
  const lessons = await listScheduledLessonsForClassesAdmin(classIds);

  const byStudent = new Map<string, ParentHomeworkProjection[number]>();
  for (const child of input.children) {
    byStudent.set(child.studentId, { studentId: child.studentId, items: [] });
  }

  for (const lesson of lessons) {
    const assignment = await getScheduledHomeworkAssignmentByLessonIdAdmin(lesson.id);
    if (!assignment) continue;

    const submissions = await listStudentHomeworkAssignmentsByScheduledAssignmentAdmin(assignment.id);
    for (const submission of submissions) {
      const bucket = byStudent.get(submission.studentId);
      if (!bucket) continue;
      bucket.items.push({
        scheduledLessonId: lesson.id,
        dueAt: assignment.dueAt,
        statusLabel: statusLabel(submission.status),
      });
    }
  }

  return Array.from(byStudent.values());
}
