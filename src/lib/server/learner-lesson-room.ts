import type { MethodologyLessonStudentContent, ReusableAsset } from "../lesson-content";
import {
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  getScheduledLessonByIdAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import {
  getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
} from "./homework-repository";

export type LearnerLessonRoomReadModel = {
  scheduledLessonId: string;
  classId: string;
  title: string;
  subtitle?: string;
  startsAt: string;
  lessonContent: MethodologyLessonStudentContent;
  assetsById: Record<string, ReusableAsset>;
  homework: {
    lessonTitle: string;
    title: string;
    kind: "practice_text" | "quiz_single_choice";
    instructions: string;
    dueAt: string | null;
    statusLabel: string;
    studentHomeworkAssignmentId: string | null;
    readOnly: boolean;
  } | null;
};

function statusLabel(status: "assigned" | "submitted" | "reviewed" | "needs_revision") {
  if (status === "assigned") return "Ожидает сдачи";
  if (status === "submitted") return "Сдано";
  if (status === "reviewed") return "Проверено";
  return "Нужна доработка";
}

export async function getLearnerLessonRoomReadModel(input: {
  scheduledLessonId: string;
  studentId: string;
  readOnlyHomework: boolean;
}, deps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonId: getMethodologyLessonStudentContentByLessonIdAdmin,
  getMethodologyHomeworkByLessonId: getMethodologyHomeworkByLessonIdAdmin,
  getScheduledHomeworkAssignmentByLessonId: getScheduledHomeworkAssignmentByLessonIdAdmin,
  listStudentHomeworkAssignmentsByScheduledAssignment:
    listStudentHomeworkAssignmentsByScheduledAssignmentAdmin,
  listReusableAssetsByIds: listReusableAssetsByIdsAdmin,
}): Promise<LearnerLessonRoomReadModel | null> {
  const scheduledLesson = await deps.getScheduledLessonById(input.scheduledLessonId);
  if (!scheduledLesson) return null;

  const [methodologyLesson, studentContent, homeworkDefinition, scheduledHomework] =
    await Promise.all([
      deps.getMethodologyLessonById(scheduledLesson.methodologyLessonId),
      deps.getMethodologyLessonStudentContentByLessonId(scheduledLesson.methodologyLessonId),
      deps.getMethodologyHomeworkByLessonId(scheduledLesson.methodologyLessonId),
      deps.getScheduledHomeworkAssignmentByLessonId(scheduledLesson.id),
    ]);

  if (!methodologyLesson || !studentContent) return null;

  const assetIds = Array.from(
    new Set(
      studentContent.sections
        .filter((section): section is Extract<MethodologyLessonStudentContent["sections"][number], { type: "media_asset" | "worksheet" }> =>
          section.type === "media_asset" || section.type === "worksheet",
        )
        .map((section) => section.assetId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const assets = assetIds.length ? await deps.listReusableAssetsByIds(assetIds) : [];
  const assetsById = Object.fromEntries(assets.map((asset) => [asset.id, asset]));

  let homework: LearnerLessonRoomReadModel["homework"] = null;
  if (homeworkDefinition && scheduledHomework) {
    const submissions = await deps.listStudentHomeworkAssignmentsByScheduledAssignment(
      scheduledHomework.id,
    );
    const mySubmission = submissions.find((item) => item.studentId === input.studentId);

    if (mySubmission) {
      homework = {
        lessonTitle: methodologyLesson.shell.title,
        title: homeworkDefinition.title,
        kind: homeworkDefinition.kind,
        instructions: homeworkDefinition.instructions,
        dueAt: scheduledHomework.dueAt,
        statusLabel: statusLabel(mySubmission.status),
        studentHomeworkAssignmentId: mySubmission.id,
        readOnly: input.readOnlyHomework,
      };
    }
  }

  return {
    scheduledLessonId: scheduledLesson.id,
    classId: scheduledLesson.runtimeShell.classId,
    title: studentContent.title,
    subtitle: studentContent.subtitle,
    startsAt: scheduledLesson.runtimeShell.startsAt,
    lessonContent: studentContent,
    assetsById,
    homework,
  };
}
