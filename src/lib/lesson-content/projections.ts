import type {
  LessonBlockInstance,
  MethodologyLesson,
  MethodologyLessonShell,
  ReusableAsset,
  ScheduledLesson,
  ScheduledLessonRuntimeShell,
} from "./contracts";
import { sortLessonBlocks } from "./contracts-helpers";

export type TeacherLessonProjection = {
  methodologyLessonId: string;
  methodologyShell: MethodologyLessonShell;
  runtimeShell: ScheduledLessonRuntimeShell;
  orderedBlocks: LessonBlockInstance[];
  runtimeNotes?: string;
  outcomeNotes?: string;
};

export type LearnerLessonProjection = {
  scheduledLessonId: string;
  title: string;
  keyVocabulary: string[];
  keyPhrases: string[];
  summary: string;
  mediaLinks: Array<{ title: string; url: string }>;
};

export function buildTeacherLessonProjection(
  methodologyLesson: MethodologyLesson,
  scheduledLesson: ScheduledLesson,
): TeacherLessonProjection {
  return {
    methodologyLessonId: methodologyLesson.id,
    methodologyShell: methodologyLesson.shell,
    runtimeShell: scheduledLesson.runtimeShell,
    orderedBlocks: sortLessonBlocks(methodologyLesson.blocks),
    runtimeNotes: scheduledLesson.runtimeNotes,
    outcomeNotes: scheduledLesson.outcomeNotes,
  };
}

export function buildLearnerLessonProjection(
  methodologyLesson: MethodologyLesson,
  scheduledLesson: ScheduledLesson,
  assets: ReusableAsset[],
): LearnerLessonProjection {
  const mediaAssetIds = new Set(
    methodologyLesson.blocks
      .flatMap((block) => block.assetRefs)
      .filter((ref) =>
        ref.kind === "video" || ref.kind === "song" || ref.kind === "media_file",
      )
      .map((ref) => ref.id),
  );

  const mediaLinks = assets
    .filter((asset) => mediaAssetIds.has(asset.id) && asset.sourceUrl)
    .map((asset) => ({
      title: asset.title,
      url: asset.sourceUrl as string,
    }));

  return {
    scheduledLessonId: scheduledLesson.id,
    title: methodologyLesson.shell.title,
    keyVocabulary: methodologyLesson.shell.vocabularySummary,
    keyPhrases: methodologyLesson.shell.phraseSummary,
    summary:
      "Краткий обзор урока и ключевых речевых паттернов для повторения дома.",
    mediaLinks,
  };
}
