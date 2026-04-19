import {
  type MethodologyLessonStudentContent,
  type ReusableAsset,
} from "../lesson-content";
import {
  listAssignedClassIdsForTeacherAdmin,
  listClassIdsForStudentAdmin,
} from "./lesson-content-repository";
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
import { logger } from "./logger";
import {
  resolveActiveLessonStep,
  type ScheduledLessonLiveState,
} from "./scheduled-lesson-live-state";
import { loadScheduledLessonUnifiedSeedAdmin } from "./scheduled-lesson-unified-context";

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

async function getStudentHomeworkCardForScheduledLesson(input: {
  studentId: string;
  classIds: string[];
  scheduledLessonId: string;
}): Promise<StudentHomeworkCard | null> {
  const homeworkCards = await getStudentHomeworkReadModel({
    studentId: input.studentId,
    classIds: input.classIds,
  });
  return homeworkCards.find((item) => item.scheduledLessonId === input.scheduledLessonId) ?? null;
}

async function getLearnerSharedProjection(scheduledLessonId: string) {
  const seed = await loadScheduledLessonUnifiedSeedAdmin(scheduledLessonId);
  if (!seed) return null;
  const workspaceProjection = buildTeacherLessonWorkspaceReadModel({
    projection: seed.projection,
    scheduledLessonId: seed.scheduledLesson.id,
    classId: seed.scheduledLesson.runtimeShell.classId,
    sourceLesson: seed.sourceLesson,
    assets: seed.coreAssets,
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
    studentContent: seed.studentContent,
    studentContentAssets: seed.studentContentAssets,
    liveState: seed.liveState,
    classDisplayName: seed.classDisplayName,
    studentContentUnavailableReason: seed.studentContentUnavailableReason,
  });
  const controlledStepId =
    resolveActiveLessonStep(
      workspaceProjection.unifiedReadModel.steps,
      workspaceProjection.liveState,
    )?.id ?? null;

  return {
    shared: {
      scheduledLessonId,
      classId: seed.scheduledLesson.runtimeShell.classId,
      lessonTitle: seed.methodologyLesson.shell.title,
      lessonSubtitle: seed.studentContent?.subtitle,
      startsAt: seed.scheduledLesson.runtimeShell.startsAt,
      runtimeStatus: seed.scheduledLesson.runtimeShell.runtimeStatus,
      liveState: workspaceProjection.liveState,
      controlledStepId,
      unifiedReadModel: workspaceProjection.unifiedReadModel,
      studentContent: seed.studentContent,
      studentContentUnavailableReason: seed.studentContentUnavailableReason,
      assetsById: workspaceProjection.unifiedReadModel.assetsById,
    } satisfies ScheduledLessonLearnerSharedView,
    scheduledLesson: seed.scheduledLesson,
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
  let base: Awaited<ReturnType<typeof getLearnerSharedProjection>> = null;
  try {
    base = await getLearnerSharedProjection(input.scheduledLessonId);
  } catch (error) {
    logger.error("[lessons] failed to load student base lesson projection", {
      scheduledLessonId: input.scheduledLessonId,
      studentId: input.studentId,
      error,
    });
    throw error;
  }
  if (!base) return null;

  let classIds: string[] = [];
  try {
    classIds = await listClassIdsForStudentAdmin(input.studentId);
  } catch (error) {
    logger.error("[lessons] failed to load student class membership", {
      scheduledLessonId: input.scheduledLessonId,
      studentId: input.studentId,
      classId: base.shared.classId,
      error,
    });
    throw error;
  }
  if (!classIds.includes(base.shared.classId)) {
    logger.warn("[lessons] student denied access to scheduled lesson", {
      scheduledLessonId: input.scheduledLessonId,
      studentId: input.studentId,
      classId: base.shared.classId,
    });
    return null;
  }

  let homework: StudentHomeworkCard | null = null;
  try {
    homework = await getStudentHomeworkCardForScheduledLesson({
      studentId: input.studentId,
      classIds,
      scheduledLessonId: input.scheduledLessonId,
    });
  } catch (error) {
    logger.error("[lessons] failed to load student homework projection", {
      scheduledLessonId: input.scheduledLessonId,
      studentId: input.studentId,
      classId: base.shared.classId,
      error,
    });
  }

  let communication: StudentScheduledLessonView["communication"] = [];
  try {
    const conversation = await getLearnerConversationPreviewReadModel({
      classId: base.shared.classId,
      studentId: input.studentId,
      filter: input.communicationFilter ?? "lesson",
      scopedLessonId: input.scheduledLessonId,
    });
    communication = conversation.messages.slice(-3).map((message) => ({
      id: message.id,
      authorRole: message.authorRole,
      body: message.body,
    }));
  } catch (error) {
    logger.error("[lessons] failed to load student communication projection", {
      scheduledLessonId: input.scheduledLessonId,
      studentId: input.studentId,
      classId: base.shared.classId,
      error,
    });
  }

  return {
    ...base.shared,
    role: "student",
    homework,
    communication,
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
