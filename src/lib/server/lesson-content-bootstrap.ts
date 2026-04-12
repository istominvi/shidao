import {
  lessonContentFixtureAssets,
  lessonContentFixtureHomeworkDefinition,
  lessonContentFixtureMethodology,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureStudentContent,
  lessonContentFixtureScheduledLesson,
} from "../lesson-content";
import { createHash } from "node:crypto";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json | Json[];
  extraHeaders?: Record<string, string>;
};

type MethodologyIdRow = { id: string };
type MethodologyLessonIdRow = { id: string };

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for lesson-content bootstrap.");
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for lesson-content bootstrap.");
  }
  return url;
}

async function adminRequest<T>(
  path: string,
  method = "GET",
  options?: RequestOptions,
): Promise<T> {
  const url = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
      ...(options?.extraHeaders ?? {}),
    },
    body: options?.payload ? JSON.stringify(options.payload) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as
      | { message?: string; msg?: string }
      | null;
    throw new Error(payloadError?.message ?? payloadError?.msg ?? "Supabase request failed.");
  }

  return (await response.json()) as T;
}

function stableUuid(seed: string): string {
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function buildFixtureBootstrapRows(options?: {
  scheduledLessonClassId?: string;
}) {
  const methodologyId = stableUuid(`methodology:${lessonContentFixtureMethodology.slug}`);
  const methodologyLessonId = stableUuid(`methodology_lesson:${lessonContentFixtureMethodologyLesson.id}`);
  const scheduledLessonId = stableUuid(`scheduled_lesson:${lessonContentFixtureScheduledLesson.id}`);

  const assetIdMap = new Map<string, string>();
  for (const asset of lessonContentFixtureAssets) {
    assetIdMap.set(asset.id, stableUuid(`reusable_asset:${asset.id}`));
  }

  const blockRows = lessonContentFixtureMethodologyLesson.blocks.map((block) => ({
    id: stableUuid(`methodology_lesson_block:${block.id}`),
    methodology_lesson_id: methodologyLessonId,
    block_type: block.blockType,
    sort_order: block.order,
    title: block.title ?? null,
    content: block.content,
  }));

  const blockAssetRows = lessonContentFixtureMethodologyLesson.blocks.flatMap((block) => {
    const blockId = stableUuid(`methodology_lesson_block:${block.id}`);
    return block.assetRefs.map((assetRef, index) => ({
      id: stableUuid(`methodology_lesson_block_asset:${block.id}:${assetRef.id}`),
      methodology_lesson_block_id: blockId,
      reusable_asset_id: assetIdMap.get(assetRef.id) ?? "",
      sort_order: index,
    }));
  });

  return {
    methodologyRow: {
      id: methodologyId,
      slug: lessonContentFixtureMethodology.slug,
      title: lessonContentFixtureMethodology.title,
      short_description: lessonContentFixtureMethodology.shortDescription ?? null,
      metadata: lessonContentFixtureMethodology.metadata ?? {},
    },
    methodologyLessonRow: {
      id: methodologyLessonId,
      methodology_id: methodologyId,
      title: lessonContentFixtureMethodologyLesson.shell.title,
      module_index: lessonContentFixtureMethodologyLesson.shell.position.moduleIndex,
      unit_index: lessonContentFixtureMethodologyLesson.shell.position.unitIndex ?? null,
      lesson_index: lessonContentFixtureMethodologyLesson.shell.position.lessonIndex,
      vocabulary_summary: lessonContentFixtureMethodologyLesson.shell.vocabularySummary,
      phrase_summary: lessonContentFixtureMethodologyLesson.shell.phraseSummary,
      estimated_duration_minutes:
        lessonContentFixtureMethodologyLesson.shell.estimatedDurationMinutes,
      readiness_status: lessonContentFixtureMethodologyLesson.shell.readinessStatus,
    },
    reusableAssetRows: lessonContentFixtureAssets.map((asset) => ({
      id: assetIdMap.get(asset.id) ?? "",
      kind: asset.kind,
      slug: asset.id,
      title: asset.title,
      description: asset.description ?? null,
      source_url: asset.sourceUrl ?? null,
      file_ref: asset.fileRef ?? null,
      metadata: asset.metadata ?? {},
    })),
    blockRows,
    blockAssetRows,
    homeworkDefinitionRow: {
      id: stableUuid(`methodology_lesson_homework:${lessonContentFixtureHomeworkDefinition.id}`),
      methodology_lesson_id: methodologyLessonId,
      title: lessonContentFixtureHomeworkDefinition.title,
      kind: lessonContentFixtureHomeworkDefinition.kind,
      instructions: lessonContentFixtureHomeworkDefinition.instructions,
      material_links: lessonContentFixtureHomeworkDefinition.materialLinks,
      answer_format_hint: lessonContentFixtureHomeworkDefinition.answerFormatHint ?? null,
      estimated_minutes: lessonContentFixtureHomeworkDefinition.estimatedMinutes ?? null,
      quiz_payload: lessonContentFixtureHomeworkDefinition.quiz ?? null,
    },
    studentContentRow: {
      id: stableUuid(`methodology_lesson_student_content:${lessonContentFixtureStudentContent.id}`),
      methodology_lesson_id: methodologyLessonId,
      title: lessonContentFixtureStudentContent.title,
      subtitle: lessonContentFixtureStudentContent.subtitle ?? null,
      content_payload: {
        sections: lessonContentFixtureStudentContent.sections,
      },
    },
    scheduledLessonRow: {
      id: scheduledLessonId,
      class_id:
        options?.scheduledLessonClassId ??
        lessonContentFixtureScheduledLesson.runtimeShell.classId,
      methodology_lesson_id: methodologyLessonId,
      starts_at: lessonContentFixtureScheduledLesson.runtimeShell.startsAt,
      format: lessonContentFixtureScheduledLesson.runtimeShell.format,
      meeting_link:
        lessonContentFixtureScheduledLesson.runtimeShell.format === "online"
          ? lessonContentFixtureScheduledLesson.runtimeShell.meetingLink
          : null,
      place:
        lessonContentFixtureScheduledLesson.runtimeShell.format === "offline"
          ? lessonContentFixtureScheduledLesson.runtimeShell.place
          : null,
      runtime_status: lessonContentFixtureScheduledLesson.runtimeShell.runtimeStatus,
      runtime_notes_summary:
        lessonContentFixtureScheduledLesson.runtimeShell.runtimeNotesSummary ?? null,
      runtime_notes: lessonContentFixtureScheduledLesson.runtimeNotes ?? null,
      outcome_notes: lessonContentFixtureScheduledLesson.outcomeNotes ?? null,
    },
  };
}

export async function bootstrapLessonContentFixtureAdmin(options?: {
  includeDevScheduledLesson?: boolean;
  scheduledLessonClassId?: string;
}) {
  const rows = buildFixtureBootstrapRows({
    scheduledLessonClassId: options?.scheduledLessonClassId,
  });

  const existingMethodology = await adminRequest<MethodologyIdRow[]>(
    `/rest/v1/methodology?select=id&slug=eq.${encodeURIComponent(rows.methodologyRow.slug)}&limit=1`,
    "GET",
  );
  const resolvedMethodologyId = existingMethodology[0]?.id ?? rows.methodologyRow.id;

  if (existingMethodology[0]) {
    await adminRequest<MethodologyIdRow[]>(
      `/rest/v1/methodology?id=eq.${resolvedMethodologyId}`,
      "PATCH",
      {
        payload: {
          slug: rows.methodologyRow.slug,
          title: rows.methodologyRow.title,
          short_description: rows.methodologyRow.short_description,
          metadata: rows.methodologyRow.metadata,
        },
      },
    );
  } else {
    await adminRequest("/rest/v1/methodology?on_conflict=slug", "POST", {
      payload: rows.methodologyRow,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    });
  }

  const existingMethodologyLesson = await adminRequest<MethodologyLessonIdRow[]>(
    `/rest/v1/methodology_lesson?select=id&methodology_id=eq.${resolvedMethodologyId}&module_index=eq.${rows.methodologyLessonRow.module_index}&lesson_index=eq.${rows.methodologyLessonRow.lesson_index}${rows.methodologyLessonRow.unit_index === null ? "&unit_index=is.null" : `&unit_index=eq.${rows.methodologyLessonRow.unit_index}`}&limit=1`,
    "GET",
  );
  const resolvedMethodologyLessonId =
    existingMethodologyLesson[0]?.id ?? rows.methodologyLessonRow.id;
  const methodologyLessonRow = {
    ...rows.methodologyLessonRow,
    id: resolvedMethodologyLessonId,
    methodology_id: resolvedMethodologyId,
  };

  await adminRequest(
    "/rest/v1/methodology_lesson?on_conflict=methodology_id,module_index,unit_index,lesson_index",
    "POST",
    {
      payload: methodologyLessonRow,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  const blockRows = rows.blockRows.map((block) => ({
    ...block,
    methodology_lesson_id: resolvedMethodologyLessonId,
  }));
  const homeworkDefinitionRow = {
    ...rows.homeworkDefinitionRow,
    methodology_lesson_id: resolvedMethodologyLessonId,
  };
  const studentContentRow = {
    ...rows.studentContentRow,
    methodology_lesson_id: resolvedMethodologyLessonId,
  };
  const scheduledLessonRow = {
    ...rows.scheduledLessonRow,
    methodology_lesson_id: resolvedMethodologyLessonId,
  };

  await adminRequest("/rest/v1/reusable_asset?on_conflict=slug", "POST", {
    payload: rows.reusableAssetRows,
    extraHeaders: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  });

  await adminRequest(
    "/rest/v1/methodology_lesson_block?on_conflict=methodology_lesson_id,sort_order",
    "POST",
    {
      payload: blockRows,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  await adminRequest(
    "/rest/v1/methodology_lesson_block_asset?on_conflict=methodology_lesson_block_id,reusable_asset_id",
    "POST",
    {
      payload: rows.blockAssetRows,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  await adminRequest(
    "/rest/v1/methodology_lesson_student_content?on_conflict=methodology_lesson_id",
    "POST",
    {
      payload: studentContentRow,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  await adminRequest(
    "/rest/v1/methodology_lesson_homework?on_conflict=methodology_lesson_id",
    "POST",
    {
      payload: homeworkDefinitionRow,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  if (options?.includeDevScheduledLesson ?? true) {
    await adminRequest("/rest/v1/scheduled_lesson?on_conflict=id", "POST", {
      payload: scheduledLessonRow,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    });
  }

  return {
    methodologyId: resolvedMethodologyId,
    methodologyLessonId: resolvedMethodologyLessonId,
    blockCount: blockRows.length,
    scheduledLessonId: scheduledLessonRow.id,
  };
}
