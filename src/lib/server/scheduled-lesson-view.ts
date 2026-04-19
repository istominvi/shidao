import {
  getFixtureStudentContentFallback,
  type MethodologyLessonStudentContent,
  type ReusableAsset,
} from "../lesson-content";
import {
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  isMissingLessonStudentContentSchemaError,
  isLessonStudentContentSchemaReadyAdmin,
  getScheduledLessonByIdAdmin,
  listAssignedClassIdsForTeacherAdmin,
  listClassIdsForStudentAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import { isInvalidLessonStudentContentPayloadError } from "./lesson-content-mappers";
import { getParentHomeworkProjection } from "./parent-homework";
import { loadParentLearningContextsByUser } from "./supabase-admin";
import {
  getStudentHomeworkReadModel,
  type StudentHomeworkCard,
} from "./student-homework";
import {
  getLearnerConversationPreviewReadModel,
  type CommunicationFilter,
} from "./communication-service";
import {
  getTeacherLessonWorkspaceByScheduledLessonId,
  buildTeacherLessonWorkspaceReadModel,
  type TeacherLessonWorkspaceReadModel,
} from "./teacher-lesson-workspace";
import { buildTeacherLessonProjection } from "../lesson-content";
import {
  mapScheduledLessonLiveState,
  resolveActiveLessonStep,
  type ScheduledLessonLiveState,
} from "./scheduled-lesson-live-state";

export type ScheduledLessonLearnerSharedView = {
  scheduledLessonId: string;
  classId: string;
  lessonTitle: string;
  lessonSubtitle?: string;
  startsAt: string;
  runtimeStatus: "planned" | "in_progress" | "completed" | "cancelled";
  liveState: ScheduledLessonLiveState;
  controlledStepId: string | null;
  unifiedReadModel: TeacherLessonWorkspaceReadModel["unifiedReadModel"];
  studentContent: MethodologyLessonStudentContent | null;
  studentContentUnavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
};

export type StudentScheduledLessonView = ScheduledLessonLearnerSharedView & {
  role: "student";
  homework: StudentHomeworkCard | null;
  communication: Array<{
    id: string;
    authorRole: "teacher" | "student" | "parent";
    body: string;
  }>;
};

export type ParentScheduledLessonView = ScheduledLessonLearnerSharedView & {
  role: "parent";
  childrenRuntime: Array<{
    studentId: string;
    studentName: string;
    lessonStatusLabel: string;
    homework: {
      homeworkTitle: string;
      dueAt: string | null;
      statusLabel: string;
      assignmentComment: string | null;
      reviewNote: string | null;
      score: number | null;
      maxScore: number | null;
    } | null;
    communicationPreview: Array<{
      id: string;
      authorRole: "teacher" | "student" | "parent";
      body: string;
    }>;
  }>;
};

export type ScheduledLessonPreviewView = ScheduledLessonLearnerSharedView & {
  role: "preview";
};

export type TeacherScheduledLessonView = {
  role: "teacher";
  workspace: TeacherLessonWorkspaceReadModel;
};

function toStudentContentUnavailableReason(
  error: unknown,
): ScheduledLessonLearnerSharedView["studentContentUnavailableReason"] {
  if (isInvalidLessonStudentContentPayloadError(error)) {
    return "invalid_payload";
  }
  const message = error instanceof Error ? error.message : "";
  if (isMissingLessonStudentContentSchemaError(message)) {
    return "schema_missing";
  }
  return "load_failed";
}

function collectStudentContentAssetIds(studentContent: MethodologyLessonStudentContent) {
  return Array.from(
    new Set(
      studentContent.sections.flatMap((section) => {
        if (section.type === "media_asset") return [section.assetId];
        if (section.type === "worksheet" && section.assetId) return [section.assetId];
        if (section.type === "presentation") return [section.assetId];
        if (section.type === "count_board" && section.assetId) return [section.assetId];
        if (section.type === "resource_links") {
          return section.resources
            .map((resource) => resource.assetId)
            .filter((id): id is string => Boolean(id));
        }
        if (section.type === "vocabulary_cards") {
          return section.items
            .map((item) => item.audioAssetId)
            .filter((id): id is string => Boolean(id));
        }
        if (section.type === "phrase_cards") {
          return section.items
            .map((item) => item.audioAssetId)
            .filter((id): id is string => Boolean(id));
        }
        if (section.type === "action_cards") {
          return section.items
            .map((item) => item.audioAssetId)
            .filter((id): id is string => Boolean(id));
        }
        if (section.type === "word_list") {
          return section.groups.flatMap((group) =>
            group.entries
              .map((entry) => entry.audioAssetId)
              .filter((id): id is string => Boolean(id)),
          );
        }
        return [];
      }),
    ),
  );
}

async function getLearnerSharedProjection(scheduledLessonId: string) {
  const scheduledLesson = await getScheduledLessonByIdAdmin(scheduledLessonId);
  if (!scheduledLesson) return null;

  const methodologyLesson = await getMethodologyLessonByIdAdmin(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) return null;

  let studentContent: MethodologyLessonStudentContent | null = null;
  let studentContentUnavailableReason: ScheduledLessonLearnerSharedView["studentContentUnavailableReason"] =
    null;
  let assets: ReusableAsset[] = [];

  try {
    studentContent = await getMethodologyLessonStudentContentByLessonIdAdmin(
      methodologyLesson.id,
    );
    if (!studentContent) {
      const studentContentSchemaReady =
        await isLessonStudentContentSchemaReadyAdmin();
      if (!studentContentSchemaReady) {
        studentContentUnavailableReason = "schema_missing";
      }
    } else {
      const assetIds = collectStudentContentAssetIds(studentContent);
      assets = assetIds.length ? await listReusableAssetsByIdsAdmin(assetIds) : [];
    }
  } catch (error) {
    studentContent = null;
    assets = [];
    studentContentUnavailableReason = toStudentContentUnavailableReason(error);
  }

  if (!studentContent) {
    const fallback = getFixtureStudentContentFallback({
      methodologySlug: methodologyLesson.methodologySlug,
      lessonTitle: methodologyLesson.shell.title,
      moduleIndex: methodologyLesson.shell.position.moduleIndex,
      lessonIndex: methodologyLesson.shell.position.lessonIndex,
    });

    if (fallback) {
      studentContent = fallback.source;
      assets = fallback.assets;
      studentContentUnavailableReason = null;
    }
  }

  const projection = buildTeacherLessonProjection(
    methodologyLesson,
    scheduledLesson,
  );
  const workspaceProjection = buildTeacherLessonWorkspaceReadModel({
    projection,
    scheduledLessonId: scheduledLesson.id,
    classId: scheduledLesson.runtimeShell.classId,
    sourceLesson: {
      methodologySlug: methodologyLesson.methodologySlug,
      lessonId: methodologyLesson.id,
      methodologyTitle: methodologyLesson.methodologyTitle ?? "Методика",
      lessonTitle: methodologyLesson.shell.title,
    },
    assets,
    homework: {
      schemaReady: true,
      definition: null,
      assignment: null,
      stats: {
        assignedCount: 0,
        submittedCount: 0,
        reviewedCount: 0,
        needsRevisionCount: 0,
        averageScore: null,
      },
      roster: [],
    },
    studentContent,
    studentContentAssets: assets,
    liveState: mapScheduledLessonLiveState(scheduledLesson),
  });
  const controlledStepId =
    resolveActiveLessonStep(
      workspaceProjection.unifiedReadModel.steps,
      workspaceProjection.liveState,
    )?.id ?? null;

  return {
    shared: {
      scheduledLessonId,
      classId: scheduledLesson.runtimeShell.classId,
      lessonTitle: methodologyLesson.shell.title,
      lessonSubtitle: studentContent?.subtitle,
      startsAt: scheduledLesson.runtimeShell.startsAt,
      runtimeStatus: scheduledLesson.runtimeShell.runtimeStatus,
      liveState: workspaceProjection.liveState,
      controlledStepId,
      unifiedReadModel: workspaceProjection.unifiedReadModel,
      studentContent,
      studentContentUnavailableReason,
      assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    } satisfies ScheduledLessonLearnerSharedView,
    scheduledLesson,
  };
}



export async function getScheduledLessonLearnerPreview(scheduledLessonId: string) {
  const base = await getLearnerSharedProjection(scheduledLessonId);
  if (!base) return null;
  return {
    ...base.shared,
    role: "preview" as const,
  };
}

export async function getTeacherScheduledLessonView(input: {
  scheduledLessonId: string;
  teacherId: string;
}): Promise<TeacherScheduledLessonView | null> {
  const [workspace, classIds] = await Promise.all([
    getTeacherLessonWorkspaceByScheduledLessonId(input.scheduledLessonId),
    listAssignedClassIdsForTeacherAdmin(input.teacherId),
  ]);
  if (!workspace) return null;
  if (!classIds.includes(workspace.classId)) return null;
  return { role: "teacher", workspace };
}

export async function getStudentScheduledLessonView(input: {
  scheduledLessonId: string;
  studentId: string;
  communicationFilter?: CommunicationFilter;
}): Promise<StudentScheduledLessonView | null> {
  const base = await getLearnerSharedProjection(input.scheduledLessonId);
  if (!base) return null;

  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  if (!classIds.includes(base.shared.classId)) return null;

  const [homeworkCards, conversation] = await Promise.all([
    getStudentHomeworkReadModel({ studentId: input.studentId, classIds }),
    getLearnerConversationPreviewReadModel({
      classId: base.shared.classId,
      studentId: input.studentId,
      filter: input.communicationFilter ?? "lesson",
      scopedLessonId: input.scheduledLessonId,
    }),
  ]);

  return {
    ...base.shared,
    role: "student",
    homework:
      homeworkCards.find((item) => item.scheduledLessonId === input.scheduledLessonId) ?? null,
    communication: conversation.messages.slice(-3).map((message) => ({
      id: message.id,
      authorRole: message.authorRole,
      body: message.body,
    })),
  };
}

function toLessonStatusLabel(status: ScheduledLessonLearnerSharedView["runtimeStatus"]) {
  if (status === "in_progress") return "Идёт урок";
  if (status === "completed") return "Урок завершён";
  if (status === "cancelled") return "Урок отменён";
  return "Урок запланирован";
}

export async function getParentScheduledLessonView(input: {
  scheduledLessonId: string;
  userId: string;
}): Promise<ParentScheduledLessonView | null> {
  const base = await getLearnerSharedProjection(input.scheduledLessonId);
  if (!base) return null;

  const contexts = await loadParentLearningContextsByUser(input.userId);
  const childrenInLesson = contexts.filter((child) =>
    child.classes.some((klass) => klass.classId === base.shared.classId),
  );

  if (childrenInLesson.length === 0) return null;

  const homeworkProjection = await getParentHomeworkProjection({
    children: childrenInLesson.map((child) => ({
      studentId: child.studentId,
      classIds: child.classes.map((item) => item.classId),
    })),
  });

  const childrenRuntime = await Promise.all(
    childrenInLesson.map(async (child) => {
      const childHomework =
        homeworkProjection
          .find((item) => item.studentId === child.studentId)
          ?.items.find((item) => item.scheduledLessonId === input.scheduledLessonId) ?? null;

      const conversation = await getLearnerConversationPreviewReadModel({
        classId: base.shared.classId,
        studentId: child.studentId,
        filter: "lesson",
        scopedLessonId: input.scheduledLessonId,
      });

      return {
        studentId: child.studentId,
        studentName: child.studentName,
        lessonStatusLabel: toLessonStatusLabel(base.shared.runtimeStatus),
        homework: childHomework
          ? {
              homeworkTitle: childHomework.homeworkTitle,
              dueAt: childHomework.dueAt,
              statusLabel: childHomework.statusLabel,
              assignmentComment: childHomework.assignmentComment,
              reviewNote: childHomework.reviewNote,
              score: childHomework.score,
              maxScore: childHomework.maxScore,
            }
          : null,
        communicationPreview: conversation.messages.slice(-3).map((message) => ({
          id: message.id,
          authorRole: message.authorRole,
          body: message.body,
        })),
      };
    }),
  );

  return {
    ...base.shared,
    role: "parent",
    childrenRuntime,
  };
}
