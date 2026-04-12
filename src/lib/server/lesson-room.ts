import { getParentHomeworkProjection } from "./parent-homework";
import {
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  getScheduledLessonByIdAdmin,
  listClassIdsForStudentAdmin,
  listScheduledLessonsForClassesAdmin,
} from "./lesson-content-repository";
import { getStudentHomeworkReadModel, type StudentHomeworkCard } from "./student-homework";
import { loadParentLearningContextsByUser } from "./supabase-admin";

export type LessonRoomShell = {
  scheduledLessonId: string;
  classId: string;
  title: string;
  startsAt: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
};

export type LearnerLessonRoomReadModel = {
  shell: LessonRoomShell;
  learnerContent: NonNullable<
    Awaited<ReturnType<typeof getMethodologyLessonStudentContentByLessonIdAdmin>>
  >;
  homework: StudentHomeworkCard | null;
  role: "student" | "parent";
  studentId: string;
};

export async function listLearnerScheduledLessonsForStudent(input: { studentId: string }) {
  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  if (classIds.length === 0) return [];

  const lessons = await listScheduledLessonsForClassesAdmin(classIds);
  const models = await Promise.all(
    lessons.map(async (lesson) => {
      const sourceLesson = await getMethodologyLessonByIdAdmin(lesson.methodologyLessonId);
      return {
        scheduledLessonId: lesson.id,
        classId: lesson.runtimeShell.classId,
        startsAt: lesson.runtimeShell.startsAt,
        status: lesson.runtimeShell.runtimeStatus,
        title: sourceLesson?.shell.title ?? "Урок",
      };
    }),
  );

  return models;
}

export async function getStudentLessonRoomReadModel(input: {
  studentId: string;
  scheduledLessonId: string;
}): Promise<LearnerLessonRoomReadModel | null> {
  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  const lesson = await getScheduledLessonByIdAdmin(input.scheduledLessonId);
  if (!lesson || !classIds.includes(lesson.runtimeShell.classId)) return null;

  const [sourceLesson, learnerContent, homeworkCards] = await Promise.all([
    getMethodologyLessonByIdAdmin(lesson.methodologyLessonId),
    getMethodologyLessonStudentContentByLessonIdAdmin(lesson.methodologyLessonId),
    getStudentHomeworkReadModel({ studentId: input.studentId, classIds }),
  ]);

  if (!sourceLesson || !learnerContent) return null;

  return {
    shell: {
      scheduledLessonId: lesson.id,
      classId: lesson.runtimeShell.classId,
      title: sourceLesson.shell.title,
      startsAt: lesson.runtimeShell.startsAt,
      status: lesson.runtimeShell.runtimeStatus,
    },
    learnerContent,
    homework: homeworkCards.find((item) => item.scheduledLessonId === lesson.id) ?? null,
    role: "student",
    studentId: input.studentId,
  };
}

export async function getParentLessonRoomReadModel(input: {
  userId: string;
  studentId: string;
  scheduledLessonId: string;
}): Promise<LearnerLessonRoomReadModel | null> {
  const children = await loadParentLearningContextsByUser(input.userId);
  const child = children.find((item) => item.studentId === input.studentId);
  if (!child) return null;

  const lesson = await getScheduledLessonByIdAdmin(input.scheduledLessonId);
  const classIds = child.classes.map((item) => item.classId);
  if (!lesson || !classIds.includes(lesson.runtimeShell.classId)) return null;

  const [sourceLesson, learnerContent, parentHomework] = await Promise.all([
    getMethodologyLessonByIdAdmin(lesson.methodologyLessonId),
    getMethodologyLessonStudentContentByLessonIdAdmin(lesson.methodologyLessonId),
    getParentHomeworkProjection({
      children: [{ studentId: input.studentId, classIds }],
    }),
  ]);

  if (!sourceLesson || !learnerContent) return null;

  const parentHomeworkItem = parentHomework
    .find((item) => item.studentId === input.studentId)
    ?.items.find((item) => item.scheduledLessonId === lesson.id);

  const homework: StudentHomeworkCard | null = parentHomeworkItem
    ? {
        classId: lesson.runtimeShell.classId,
        scheduledLessonId: lesson.id,
        scheduledHomeworkAssignmentId: `parent-${lesson.id}`,
        lessonTitle: parentHomeworkItem.lessonTitle,
        homeworkTitle: parentHomeworkItem.homeworkTitle,
        kind: "practice_text",
        instructions: "Домашнее задание доступно ребёнку в ученическом кабинете.",
        dueAt: parentHomeworkItem.dueAt,
        issueComment: parentHomeworkItem.assignmentComment,
        status: "assigned",
        statusLabel: parentHomeworkItem.statusLabel,
        studentHomeworkAssignmentId: `parent-${lesson.id}`,
        submissionText: null,
        submissionPayload: null,
        reviewNote: parentHomeworkItem.reviewNote,
        score: parentHomeworkItem.score,
        maxScore: parentHomeworkItem.maxScore,
        quizMeta: null,
        quizDefinition: null,
      }
    : null;

  return {
    shell: {
      scheduledLessonId: lesson.id,
      classId: lesson.runtimeShell.classId,
      title: sourceLesson.shell.title,
      startsAt: lesson.runtimeShell.startsAt,
      status: lesson.runtimeShell.runtimeStatus,
    },
    learnerContent,
    homework,
    role: "parent",
    studentId: input.studentId,
  };
}
