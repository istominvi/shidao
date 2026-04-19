import {
  buildTeacherLessonProjection,
  getFixtureStudentContentFallback,
  type LessonBlockInstance,
  type MethodologyLesson,
  type MethodologyLessonStudentContent,
  type ReusableAsset,
  type ScheduledLesson,
  type TeacherLessonProjection,
} from "../lesson-content";
import {
  getClassDisplayNameByIdAdmin,
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  getScheduledLessonByIdAdmin,
  isLessonStudentContentSchemaReadyAdmin,
  isMissingLessonStudentContentSchemaError,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import { isInvalidLessonStudentContentPayloadError } from "./lesson-content-mappers";
import { mapScheduledLessonLiveState } from "./scheduled-lesson-live-state";

export type ScheduledLessonUnifiedSeed = {
  scheduledLesson: ScheduledLesson;
  methodologyLesson: MethodologyLesson;
  projection: TeacherLessonProjection;
  sourceLesson: {
    methodologySlug: string;
    lessonId: string;
    methodologyTitle: string;
    lessonTitle: string;
  };
  classDisplayName: string | null;
  coreAssets: ReusableAsset[];
  studentContent: MethodologyLessonStudentContent | null;
  studentContentAssets: ReusableAsset[];
  studentContentUnavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  liveState: ReturnType<typeof mapScheduledLessonLiveState>;
};

function collectAssetIds(blocks: LessonBlockInstance[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.assetRefs.map((assetRef) => assetRef.id).filter(Boolean),
      ),
    ),
  );
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

function toStudentContentUnavailableReason(error: unknown): ScheduledLessonUnifiedSeed["studentContentUnavailableReason"] {
  if (isInvalidLessonStudentContentPayloadError(error)) {
    return "invalid_payload";
  }
  const message = error instanceof Error ? error.message : "";
  if (isMissingLessonStudentContentSchemaError(message)) {
    return "schema_missing";
  }
  return "load_failed";
}

export async function loadScheduledLessonUnifiedSeedAdmin(
  scheduledLessonId: string,
): Promise<ScheduledLessonUnifiedSeed | null> {
  const scheduledLesson = await getScheduledLessonByIdAdmin(scheduledLessonId);
  if (!scheduledLesson) return null;

  const methodologyLesson = await getMethodologyLessonByIdAdmin(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) return null;

  const projection = buildTeacherLessonProjection(methodologyLesson, scheduledLesson);
  const coreAssetIds = collectAssetIds(projection.orderedBlocks);
  const [coreAssets, classDisplayName] = await Promise.all([
    coreAssetIds.length ? listReusableAssetsByIdsAdmin(coreAssetIds) : Promise.resolve([]),
    getClassDisplayNameByIdAdmin(scheduledLesson.runtimeShell.classId),
  ]);

  let studentContent: MethodologyLessonStudentContent | null = null;
  let studentContentUnavailableReason: ScheduledLessonUnifiedSeed["studentContentUnavailableReason"] = null;
  let studentContentAssets: ReusableAsset[] = [];

  try {
    studentContent = await getMethodologyLessonStudentContentByLessonIdAdmin(
      methodologyLesson.id,
    );

    if (!studentContent) {
      const studentContentSchemaReady = await isLessonStudentContentSchemaReadyAdmin();
      if (!studentContentSchemaReady) {
        studentContentUnavailableReason = "schema_missing";
      }
    } else {
      const studentAssetIds = collectStudentContentAssetIds(studentContent);
      studentContentAssets = studentAssetIds.length
        ? await listReusableAssetsByIdsAdmin(studentAssetIds)
        : [];
    }
  } catch (error) {
    studentContent = null;
    studentContentAssets = [];
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
      studentContentAssets = fallback.assets;
      studentContentUnavailableReason = null;
    }
  }

  return {
    scheduledLesson,
    methodologyLesson,
    projection,
    sourceLesson: {
      methodologySlug: methodologyLesson.methodologySlug,
      lessonId: methodologyLesson.id,
      methodologyTitle: projection.methodologyTitle?.trim() || "Методика",
      lessonTitle: methodologyLesson.shell.title,
    },
    classDisplayName,
    coreAssets,
    studentContent,
    studentContentAssets,
    studentContentUnavailableReason,
    liveState: mapScheduledLessonLiveState(scheduledLesson),
  };
}
