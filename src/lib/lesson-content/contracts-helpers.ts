import type {
  LessonBlockInstance,
  MethodologyLessonShell,
  ReusableAsset,
  ScheduledLessonRuntimeShell,
} from "./contracts";
import type { RuntimeLessonFormat } from "./types";

export function isRuntimeLessonFormat(value: string): value is RuntimeLessonFormat {
  return value === "online" || value === "offline";
}

export function sortLessonBlocks(
  blocks: LessonBlockInstance[],
): LessonBlockInstance[] {
  return [...blocks].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.id.localeCompare(b.id);
  });
}

export function summarizeAssetsByKind(
  assets: ReusableAsset[],
): Record<ReusableAsset["kind"], number> {
  return assets.reduce<Record<ReusableAsset["kind"], number>>(
    (acc, asset) => {
      acc[asset.kind] += 1;
      return acc;
    },
    {
      video: 0,
      song: 0,
      worksheet: 0,
      vocabulary_set: 0,
      activity_template: 0,
      media_file: 0,
      presentation: 0,
      flashcards_pdf: 0,
      lesson_video: 0,
      worksheet_pdf: 0,
      song_audio: 0,
      song_video: 0,
      pronunciation_audio: 0,
    },
  );
}

export function isMethodologyLessonShell(
  shell: MethodologyLessonShell | ScheduledLessonRuntimeShell,
): shell is MethodologyLessonShell {
  return "readinessStatus" in shell;
}

export function isScheduledLessonRuntimeShell(
  shell: MethodologyLessonShell | ScheduledLessonRuntimeShell,
): shell is ScheduledLessonRuntimeShell {
  return "runtimeStatus" in shell;
}
