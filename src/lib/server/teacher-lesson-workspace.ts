import {
  buildTeacherLessonProjection,
  sortLessonBlocks,
  type LessonBlockInstance,
  type ReusableAsset,
  type TeacherLessonProjection,
} from "../lesson-content";
import type { AccessResolution } from "./access-policy";
import {
  getMethodologyLessonByIdAdmin,
  getScheduledLessonByIdAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";

export type TeacherLessonWorkspaceReadModel = {
  scheduledLessonId: string;
  classId: string;
  projection: TeacherLessonProjection;
  assetsById: Record<string, ReusableAsset>;
};

type WorkspaceLoaderDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  listReusableAssetsByIds: typeof listReusableAssetsByIdsAdmin;
};

const defaultWorkspaceLoaderDeps: WorkspaceLoaderDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  listReusableAssetsByIds: listReusableAssetsByIdsAdmin,
};

export function canAccessTeacherLessonWorkspace(
  resolution: AccessResolution,
): boolean {
  return (
    resolution.status === "adult-with-profile" &&
    resolution.context.actorKind !== "student" &&
    resolution.activeProfile === "teacher"
  );
}

export function buildTeacherLessonWorkspaceReadModel(input: {
  projection: TeacherLessonProjection;
  scheduledLessonId: string;
  classId: string;
  assets: ReusableAsset[];
}): TeacherLessonWorkspaceReadModel {
  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: input.classId,
    projection: {
      ...input.projection,
      orderedBlocks: sortLessonBlocks(input.projection.orderedBlocks),
    },
    assetsById: Object.fromEntries(input.assets.map((asset) => [asset.id, asset])),
  };
}

function collectAssetIds(blocks: LessonBlockInstance[]) {
  return Array.from(
    new Set(blocks.flatMap((block) => block.assetRefs.map((assetRef) => assetRef.id))),
  );
}

export async function getTeacherLessonWorkspaceByScheduledLessonId(
  scheduledLessonId: string,
  deps: WorkspaceLoaderDeps = defaultWorkspaceLoaderDeps,
): Promise<TeacherLessonWorkspaceReadModel | null> {
  const scheduledLesson = await deps.getScheduledLessonById(scheduledLessonId);
  if (!scheduledLesson) {
    return null;
  }

  const methodologyLesson = await deps.getMethodologyLessonById(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) {
    return null;
  }

  const projection = buildTeacherLessonProjection(
    methodologyLesson,
    scheduledLesson,
  );
  const assetIds = collectAssetIds(projection.orderedBlocks);
  const assets = assetIds.length
    ? await deps.listReusableAssetsByIds(assetIds)
    : [];

  return buildTeacherLessonWorkspaceReadModel({
    projection,
    scheduledLessonId: scheduledLesson.id,
    classId: scheduledLesson.runtimeShell.classId,
    assets,
  });
}

export function getDevTeacherScheduledLessonId() {
  return process.env.DEV_TEACHER_WORKSPACE_SCHEDULED_LESSON_ID?.trim() || "";
}
