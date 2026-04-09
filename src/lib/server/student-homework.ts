import {
  getMethodologyLessonByIdAdmin,
  getScheduledLessonByIdAdmin,
  listScheduledLessonsForClassesAdmin,
} from "./lesson-content-repository";
import {
  getStudentHomeworkAssignmentByIdAdmin,
  getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByIdAdmin,
  getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  updateStudentHomeworkSubmissionAdmin,
} from "./homework-repository";
import {
  gradeQuizSingleChoice,
  normalizeQuizSubmissionPayload,
  resolveHomeworkQuiz,
} from "../homework/quiz";

export type StudentHomeworkCard = {
  classId: string;
  scheduledLessonId: string;
  scheduledHomeworkAssignmentId: string;
  lessonTitle: string;
  homeworkTitle: string;
  kind: "practice_text" | "quiz_single_choice";
  instructions: string;
  dueAt: string | null;
  issueComment: string | null;
  status: "assigned" | "submitted" | "reviewed" | "needs_revision";
  statusLabel: string;
  studentHomeworkAssignmentId: string;
  submissionText: string | null;
  submissionPayload: Record<string, unknown> | null;
  reviewNote: string | null;
  score: number | null;
  maxScore: number | null;
  quizMeta:
    | {
        questionCount: number;
        estimatedMinutes?: number;
      }
    | null;
  quizDefinition?: Record<string, unknown> | null;
};

type StudentHomeworkDeps = {
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  getMethodologyHomeworkByLessonId: typeof getMethodologyHomeworkByLessonIdAdmin;
  getScheduledHomeworkAssignmentByLessonId: typeof getScheduledHomeworkAssignmentByLessonIdAdmin;
  getScheduledHomeworkAssignmentById: typeof getScheduledHomeworkAssignmentByIdAdmin;
  listStudentHomeworkAssignmentsByScheduledAssignment: typeof listStudentHomeworkAssignmentsByScheduledAssignmentAdmin;
  getStudentHomeworkAssignmentById: typeof getStudentHomeworkAssignmentByIdAdmin;
  updateStudentHomeworkSubmission: typeof updateStudentHomeworkSubmissionAdmin;
};

const defaultDeps: StudentHomeworkDeps = {
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  getMethodologyHomeworkByLessonId: getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonId: getScheduledHomeworkAssignmentByLessonIdAdmin,
  getScheduledHomeworkAssignmentById: getScheduledHomeworkAssignmentByIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignment:
    listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  getStudentHomeworkAssignmentById: getStudentHomeworkAssignmentByIdAdmin,
  updateStudentHomeworkSubmission: updateStudentHomeworkSubmissionAdmin,
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

export async function getStudentHomeworkReadModel(
  input: {
    studentId: string;
    classIds: string[];
  },
  deps: StudentHomeworkDeps = defaultDeps,
) {
  const lessons = await deps.listScheduledLessonsForClasses(input.classIds);
  const cards: StudentHomeworkCard[] = [];

  for (const lesson of lessons) {
    const assignment = await deps.getScheduledHomeworkAssignmentByLessonId(lesson.id);
    if (!assignment) continue;

    const [homeworkDefinition, methodologyLesson, perStudent] = await Promise.all([
      deps.getMethodologyHomeworkByLessonId(lesson.methodologyLessonId),
      deps.getMethodologyLessonById(lesson.methodologyLessonId),
      deps.listStudentHomeworkAssignmentsByScheduledAssignment(assignment.id),
    ]);

    const studentAssignment = perStudent.find((item) => item.studentId === input.studentId);
    if (!homeworkDefinition || !studentAssignment) continue;

    const quiz = resolveHomeworkQuiz(homeworkDefinition);

    cards.push({
      classId: lesson.runtimeShell.classId,
      scheduledLessonId: lesson.id,
      scheduledHomeworkAssignmentId: assignment.id,
      lessonTitle: methodologyLesson?.shell.title ?? "Урок",
      homeworkTitle: homeworkDefinition.title,
      kind: homeworkDefinition.kind,
      instructions: homeworkDefinition.instructions,
      dueAt: assignment.dueAt,
      issueComment: assignment.assignmentComment,
      status: studentAssignment.status,
      statusLabel: statusLabel(studentAssignment.status),
      studentHomeworkAssignmentId: studentAssignment.id,
      submissionText: studentAssignment.submissionText,
      submissionPayload: studentAssignment.submissionPayload,
      reviewNote: studentAssignment.reviewNote,
      score: studentAssignment.autoScore,
      maxScore: studentAssignment.autoMaxScore,
      quizMeta: quiz
        ? {
            questionCount: quiz.questions.length,
            estimatedMinutes: homeworkDefinition.estimatedMinutes,
          }
        : null,
      quizDefinition: homeworkDefinition.quiz ?? null,
    });
  }

  return cards.sort((a, b) => {
    const aTs = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
    const bTs = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
    return aTs - bTs;
  });
}

export async function submitStudentHomework(
  input: {
    studentId: string;
    studentHomeworkAssignmentId: string;
    submissionText?: string;
    submissionPayload?: unknown;
  },
  deps: StudentHomeworkDeps = defaultDeps,
) {
  const assignment = await deps.getStudentHomeworkAssignmentById(
    input.studentHomeworkAssignmentId,
  );
  if (!assignment || assignment.studentId !== input.studentId) {
    throw new Error("Домашнее задание не найдено для этого ученика.");
  }

  const scheduledAssignment = await deps.getScheduledHomeworkAssignmentById(
    assignment.scheduledHomeworkAssignmentId,
  );
  const scheduledLesson = scheduledAssignment
    ? await deps.getScheduledLessonById(scheduledAssignment.scheduledLessonId)
    : null;

  if (!scheduledLesson) {
    throw new Error("Не найден контекст занятия для домашнего задания.");
  }

  const definition = await deps.getMethodologyHomeworkByLessonId(scheduledLesson.methodologyLessonId);
  if (!definition) {
    throw new Error("Определение домашнего задания не найдено.");
  }

  const submittedAt = new Date().toISOString();

  if (definition.kind === "practice_text") {
    const normalized = `${input.submissionText ?? ""}`.trim();
    if (!normalized) {
      throw new Error("Добавьте текст ответа перед отправкой.");
    }

    return deps.updateStudentHomeworkSubmission({
      studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
      status: "submitted",
      submissionText: normalized,
      submissionPayload: null,
      autoScore: null,
      autoMaxScore: null,
      autoCheckedAt: null,
      submittedAt,
    });
  }

  const quiz = resolveHomeworkQuiz(definition);
  if (!quiz) {
    throw new Error("Тест пока недоступен: проверьте данные методики.");
  }

  const payload = normalizeQuizSubmissionPayload(input.submissionPayload);
  if (!payload) {
    throw new Error("Не удалось прочитать ответы теста.");
  }

  const grade = gradeQuizSingleChoice(quiz, payload);

  return deps.updateStudentHomeworkSubmission({
    studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
    status: "submitted",
    submissionText: null,
    submissionPayload: {
      ...payload,
      result: grade,
    },
    autoScore: grade.score,
    autoMaxScore: grade.maxScore,
    autoCheckedAt: submittedAt,
    submittedAt,
  });
}
