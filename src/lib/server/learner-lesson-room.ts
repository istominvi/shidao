import type {
  MethodologyLessonStudentContent,
  ReusableAsset,
} from "../lesson-content";
import {
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  isLessonStudentContentSchemaReadyAdmin,
  getScheduledLessonByIdAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import { getParentHomeworkProjection } from "./parent-homework";
import {
  getStudentHomeworkReadModel,
  type StudentHomeworkCard,
} from "./student-homework";

export type LearnerHomeworkCard =
  | {
      role: "student";
      card: StudentHomeworkCard;
    }
  | {
      role: "parent";
      card: {
        lessonTitle: string;
        homeworkTitle: string;
        dueAt: string | null;
        statusLabel: string;
        assignmentComment: string | null;
        reviewNote: string | null;
        score: number | null;
        maxScore: number | null;
      };
    };

export type LearnerLessonRoomReadModel = {
  scheduledLessonId: string;
  classId: string;
  lessonTitle: string;
  lessonSubtitle?: string;
  startsAt: string;
  runtimeStatus: "planned" | "in_progress" | "completed" | "cancelled";
  studentContent: MethodologyLessonStudentContent | null;
  studentContentUnavailableDueToSchema: boolean;
  assetsById: Record<string, ReusableAsset>;
  homework: LearnerHomeworkCard | null;
};

type LearnerLessonRoomDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  getMethodologyLessonStudentContentByLessonId: typeof getMethodologyLessonStudentContentByLessonIdAdmin;
  isLessonStudentContentSchemaReady: typeof isLessonStudentContentSchemaReadyAdmin;
  listReusableAssetsByIds: typeof listReusableAssetsByIdsAdmin;
  getStudentHomeworkReadModel: typeof getStudentHomeworkReadModel;
  loadParentLearningContextsByUser?: (userId: string) => Promise<
    Array<{
      studentId: string;
      studentName: string;
      login: string;
      classes: Array<{ classId: string; className: string; schoolId: string; schoolName: string }>;
    }>
  >;
  getParentHomeworkProjection: typeof getParentHomeworkProjection;
};

const defaultDeps: LearnerLessonRoomDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonId:
    getMethodologyLessonStudentContentByLessonIdAdmin,
  isLessonStudentContentSchemaReady: isLessonStudentContentSchemaReadyAdmin,
  listReusableAssetsByIds: listReusableAssetsByIdsAdmin,
  getStudentHomeworkReadModel,
  getParentHomeworkProjection,
};

async function getBaseLessonRoom(
  scheduledLessonId: string,
  deps: LearnerLessonRoomDeps,
) {
  const scheduledLesson = await deps.getScheduledLessonById(scheduledLessonId);
  if (!scheduledLesson) return null;

  const methodologyLesson = await deps.getMethodologyLessonById(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) return null;

  const studentContent = await deps.getMethodologyLessonStudentContentByLessonId(
    methodologyLesson.id,
  );
  const studentContentSchemaReady = studentContent
    ? true
    : await deps.isLessonStudentContentSchemaReady();

  const assetIds = Array.from(
    new Set(
      (studentContent?.sections ?? [])
        .flatMap((section) => {
          if (section.type === "media_asset") return [section.assetId];
          if (section.type === "worksheet" && section.assetId) return [section.assetId];
          return [];
        })
        .filter(Boolean),
    ),
  );
  const assets = assetIds.length
    ? await deps.listReusableAssetsByIds(assetIds)
    : [];

  return {
    scheduledLesson,
    methodologyLesson,
    studentContent,
    studentContentUnavailableDueToSchema:
      !studentContent && !studentContentSchemaReady,
    assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
  };
}

export async function getLessonRoomPreviewByScheduledLessonId(
  scheduledLessonId: string,
  deps: LearnerLessonRoomDeps = defaultDeps,
): Promise<Omit<LearnerLessonRoomReadModel, "homework"> | null> {
  const base = await getBaseLessonRoom(scheduledLessonId, deps);
  if (!base) return null;

  return {
    scheduledLessonId,
    classId: base.scheduledLesson.runtimeShell.classId,
    lessonTitle: base.methodologyLesson.shell.title,
    lessonSubtitle: base.studentContent?.subtitle,
    startsAt: base.scheduledLesson.runtimeShell.startsAt,
    runtimeStatus: base.scheduledLesson.runtimeShell.runtimeStatus,
    studentContent: base.studentContent,
    studentContentUnavailableDueToSchema: base.studentContentUnavailableDueToSchema,
    assetsById: base.assetsById,
  };
}

export async function getStudentLessonRoomReadModel(input: {
  studentId: string;
  classIds: string[];
  scheduledLessonId: string;
}, deps: LearnerLessonRoomDeps = defaultDeps): Promise<LearnerLessonRoomReadModel | null> {
  const base = await getBaseLessonRoom(input.scheduledLessonId, deps);
  if (!base) return null;

  if (!input.classIds.includes(base.scheduledLesson.runtimeShell.classId)) {
    return null;
  }

  const homeworkCards = await deps.getStudentHomeworkReadModel({
    studentId: input.studentId,
    classIds: input.classIds,
  });

  const homeworkCard =
    homeworkCards.find(
      (item) => item.scheduledLessonId === input.scheduledLessonId,
    ) ?? null;

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: base.scheduledLesson.runtimeShell.classId,
    lessonTitle: base.methodologyLesson.shell.title,
    lessonSubtitle: base.studentContent?.subtitle,
    startsAt: base.scheduledLesson.runtimeShell.startsAt,
    runtimeStatus: base.scheduledLesson.runtimeShell.runtimeStatus,
    studentContent: base.studentContent,
    studentContentUnavailableDueToSchema: base.studentContentUnavailableDueToSchema,
    assetsById: base.assetsById,
    homework: homeworkCard ? { role: "student", card: homeworkCard } : null,
  };
}

export async function getParentLessonRoomReadModel(input: {
  userId: string;
  studentId: string;
  scheduledLessonId: string;
}, deps: LearnerLessonRoomDeps = defaultDeps): Promise<LearnerLessonRoomReadModel | null> {
  const loadParentContexts =
    deps.loadParentLearningContextsByUser ??
    (async (userId: string) => {
      const mod = await import("./supabase-admin");
      return mod.loadParentLearningContextsByUser(userId);
    });
  const contexts = await loadParentContexts(input.userId);
  const child = contexts.find((item) => item.studentId === input.studentId);
  if (!child) return null;

  const base = await getBaseLessonRoom(input.scheduledLessonId, deps);
  if (!base) return null;

  const childClassIds = child.classes.map((item) => item.classId);
  if (!childClassIds.includes(base.scheduledLesson.runtimeShell.classId)) {
    return null;
  }

  const homeworkProjection = await deps.getParentHomeworkProjection({
    children: [
      {
        studentId: child.studentId,
        classIds: childClassIds,
      },
    ],
  });

  const lessonHomework =
    homeworkProjection
      .flatMap((item) => item.items)
      .find((item) => item.scheduledLessonId === input.scheduledLessonId) ?? null;

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: base.scheduledLesson.runtimeShell.classId,
    lessonTitle: base.methodologyLesson.shell.title,
    lessonSubtitle: base.studentContent?.subtitle,
    startsAt: base.scheduledLesson.runtimeShell.startsAt,
    runtimeStatus: base.scheduledLesson.runtimeShell.runtimeStatus,
    studentContent: base.studentContent,
    studentContentUnavailableDueToSchema: base.studentContentUnavailableDueToSchema,
    assetsById: base.assetsById,
    homework: lessonHomework
      ? {
          role: "parent",
          card: {
            lessonTitle: lessonHomework.lessonTitle,
            homeworkTitle: lessonHomework.homeworkTitle,
            dueAt: lessonHomework.dueAt,
            statusLabel: lessonHomework.statusLabel,
            assignmentComment: lessonHomework.assignmentComment,
            reviewNote: lessonHomework.reviewNote,
            score: lessonHomework.score,
            maxScore: lessonHomework.maxScore,
          },
        }
      : null,
  };
}
