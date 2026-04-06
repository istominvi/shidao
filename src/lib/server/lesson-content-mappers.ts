import type {
  LessonBlockInstance,
  Methodology,
  MethodologyLesson,
  ReusableAsset,
  ScheduledLesson,
  ScheduledLessonRuntimeShell,
} from "../lesson-content";
import { sortLessonBlocks } from "../lesson-content";

type RowMethodology = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  metadata: Record<string, unknown> | null;
};

type RowAsset = {
  id: string;
  kind: ReusableAsset["kind"];
  title: string;
  description: string | null;
  source_url: string | null;
  file_ref: string | null;
  metadata: ReusableAsset["metadata"] | null;
};

type RowBlockAssetLink = {
  sort_order: number;
  reusable_asset_id: string;
  asset: RowAsset | null;
};

type RowMethodologyLessonBlock = {
  id: string;
  block_type: LessonBlockInstance["blockType"];
  sort_order: number;
  title: string | null;
  content: Record<string, unknown>;
  block_assets: RowBlockAssetLink[] | null;
};

export type RowMethodologyLessonWithBlocks = {
  id: string;
  methodology_id: string;
  title: string;
  module_index: number;
  unit_index: number | null;
  lesson_index: number;
  vocabulary_summary: string[];
  phrase_summary: string[];
  estimated_duration_minutes: number;
  readiness_status: "draft" | "ready" | "archived";
  methodology: Pick<RowMethodology, "slug"> | null;
  blocks: RowMethodologyLessonBlock[] | null;
};

export type RowScheduledLesson = {
  id: string;
  class_id: string;
  methodology_lesson_id: string;
  starts_at: string;
  format: "online" | "offline";
  meeting_link: string | null;
  place: string | null;
  runtime_status: "planned" | "in_progress" | "completed" | "cancelled";
  runtime_notes_summary: string | null;
  runtime_notes: string | null;
  outcome_notes: string | null;
};

function mapRuntimeShellFromRow(row: RowScheduledLesson): ScheduledLessonRuntimeShell {
  const base = {
    id: row.id,
    classId: row.class_id,
    startsAt: row.starts_at,
    runtimeStatus: row.runtime_status,
    runtimeNotesSummary: row.runtime_notes_summary ?? undefined,
  };

  if (row.format === "online") {
    if (!row.meeting_link || row.place) {
      throw new Error("Invalid online scheduled_lesson row: meeting_link/place mismatch.");
    }

    return {
      ...base,
      format: "online",
      meetingLink: row.meeting_link,
    };
  }

  if (!row.place || row.meeting_link) {
    throw new Error("Invalid offline scheduled_lesson row: meeting_link/place mismatch.");
  }

  return {
    ...base,
    format: "offline",
    place: row.place,
  };
}

export function mapMethodologyRowToDomain(row: RowMethodology): Methodology {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description ?? undefined,
    metadata: (row.metadata as Methodology["metadata"]) ?? undefined,
  };
}

function mapAssetRowToDomain(row: RowAsset): ReusableAsset {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    fileRef: row.file_ref ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function mapBlockRowToDomain(row: RowMethodologyLessonBlock): LessonBlockInstance {
  const sortedLinks = [...(row.block_assets ?? [])].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.reusable_asset_id.localeCompare(b.reusable_asset_id);
  });

  return {
    id: row.id,
    blockType: row.block_type,
    order: row.sort_order,
    title: row.title ?? undefined,
    content: row.content,
    assetRefs: sortedLinks.map((link) => {
      const sourceAsset = link.asset;
      if (!sourceAsset) {
        throw new Error(`Missing reusable_asset relation for block asset ${link.reusable_asset_id}.`);
      }
      return { kind: sourceAsset.kind, id: link.reusable_asset_id };
    }),
  } as LessonBlockInstance;
}

function buildMediaSummary(blocks: LessonBlockInstance[]) {
  const seenByKind = new Set<string>();
  const summary = {
    videos: 0,
    songs: 0,
    worksheets: 0,
    other: 0,
  };

  for (const ref of blocks.flatMap((block) => block.assetRefs)) {
    const key = `${ref.kind}:${ref.id}`;
    if (seenByKind.has(key)) continue;
    seenByKind.add(key);

    if (ref.kind === "video") summary.videos += 1;
    else if (ref.kind === "song") summary.songs += 1;
    else if (ref.kind === "worksheet") summary.worksheets += 1;
    else summary.other += 1;
  }

  return summary;
}

export function mapMethodologyLessonRowToDomain(
  row: RowMethodologyLessonWithBlocks,
): MethodologyLesson {
  const blocks = sortLessonBlocks((row.blocks ?? []).map(mapBlockRowToDomain));

  return {
    id: row.id,
    methodologyId: row.methodology_id,
    methodologySlug: row.methodology?.slug ?? "",
    shell: {
      id: row.id,
      methodologyId: row.methodology_id,
      title: row.title,
      position: {
        moduleIndex: row.module_index,
        unitIndex: row.unit_index ?? undefined,
        lessonIndex: row.lesson_index,
      },
      vocabularySummary: row.vocabulary_summary,
      phraseSummary: row.phrase_summary,
      estimatedDurationMinutes: row.estimated_duration_minutes,
      mediaSummary: buildMediaSummary(blocks),
      readinessStatus: row.readiness_status,
    },
    blocks,
  };
}

export function mapScheduledLessonRowToDomain(row: RowScheduledLesson): ScheduledLesson {
  return {
    id: row.id,
    methodologyLessonId: row.methodology_lesson_id,
    runtimeShell: mapRuntimeShellFromRow(row),
    runtimeNotes: row.runtime_notes ?? undefined,
    outcomeNotes: row.outcome_notes ?? undefined,
  };
}

export function mapReusableAssetRowsToDomain(rows: RowAsset[]): ReusableAsset[] {
  return rows.map(mapAssetRowToDomain);
}
