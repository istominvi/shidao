import {
  lessonContentFixtureAssets,
  lessonContentFixtureHomeworkDefinitions,
  lessonContentFixtureMethodology,
  lessonContentFixtureMethodologyLessons,
  lessonContentFixtureMethodologyLessonStudentContents,
  lessonContentFixtureScheduledLessons,
} from "../lesson-content";
import { createHash } from "node:crypto";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json | Json[];
  extraHeaders?: Record<string, string>;
};

type MethodologyIdRow = { id: string };
type MethodologyLessonIdRow = { id: string };

type FixtureBootstrapRows = ReturnType<typeof buildFixtureBootstrapRows>;

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

function normalizeMethodologyDisplayTitle(title: string) {
  return title.trim().replace(/\s*[—]\s*/g, " – ");
}

export function buildFixtureBootstrapRows(options?: {
  scheduledLessonClassId?: string;
}) {
  const methodologyId = stableUuid(`methodology:${lessonContentFixtureMethodology.slug}`);

  const assetIdMap = new Map<string, string>();
  for (const asset of lessonContentFixtureAssets) {
    assetIdMap.set(asset.id, stableUuid(`reusable_asset:${asset.id}`));
  }

  const methodologyLessonRows = lessonContentFixtureMethodologyLessons.map((lesson) => ({
    id: stableUuid(`methodology_lesson:${lesson.id}`),
    fixtureLessonId: lesson.id,
    methodology_id: methodologyId,
    title: lesson.shell.title,
    module_index: lesson.shell.position.moduleIndex,
    unit_index: lesson.shell.position.unitIndex ?? null,
    lesson_index: lesson.shell.position.lessonIndex,
    vocabulary_summary: lesson.shell.vocabularySummary,
    phrase_summary: lesson.shell.phraseSummary,
    estimated_duration_minutes: lesson.shell.estimatedDurationMinutes,
    readiness_status: lesson.shell.readinessStatus,
  }));

  const lessonIdMap = new Map(
    methodologyLessonRows.map((row) => [row.fixtureLessonId, row.id]),
  );

  const blockRows = lessonContentFixtureMethodologyLessons.flatMap((lesson) =>
    lesson.blocks.map((block) => ({
      id: stableUuid(`methodology_lesson_block:${block.id}`),
      methodology_lesson_id: lessonIdMap.get(lesson.id) ?? "",
      block_type: block.blockType,
      sort_order: block.order,
      title: block.title ?? null,
      content: block.content,
    })),
  );

  const blockAssetRows = lessonContentFixtureMethodologyLessons.flatMap((lesson) =>
    lesson.blocks.flatMap((block) => {
      const blockId = stableUuid(`methodology_lesson_block:${block.id}`);
      return block.assetRefs.map((assetRef, index) => ({
        id: stableUuid(`methodology_lesson_block_asset:${block.id}:${assetRef.id}`),
        methodology_lesson_block_id: blockId,
        reusable_asset_id: assetIdMap.get(assetRef.id) ?? "",
        sort_order: index,
      }));
    }),
  );

  const homeworkDefinitionRows = lessonContentFixtureHomeworkDefinitions.map((homework) => ({
    id: stableUuid(`methodology_lesson_homework:${homework.id}`),
    methodology_lesson_id: lessonIdMap.get(homework.methodologyLessonId) ?? "",
    title: homework.title,
    kind: homework.kind,
    instructions: homework.instructions,
    material_links: homework.materialLinks,
    answer_format_hint: homework.answerFormatHint ?? null,
    estimated_minutes: homework.estimatedMinutes ?? null,
    quiz_payload: homework.quiz ?? null,
  }));

  const studentContentRows = lessonContentFixtureMethodologyLessonStudentContents.map(
    (studentContent) => ({
      id: stableUuid(`methodology_lesson_student_content:${studentContent.id}`),
      methodology_lesson_id: lessonIdMap.get(studentContent.methodologyLessonId) ?? "",
      title: studentContent.title,
      subtitle: studentContent.subtitle ?? null,
      content_payload: {
        sections: studentContent.sections,
      },
    }),
  );

  const scheduledLessonRows = lessonContentFixtureScheduledLessons.map((scheduledLesson) => ({
    id: stableUuid(`scheduled_lesson:${scheduledLesson.id}`),
    fixtureScheduledLessonId: scheduledLesson.id,
    fixtureMethodologyLessonId: scheduledLesson.methodologyLessonId,
    class_id: options?.scheduledLessonClassId ?? scheduledLesson.runtimeShell.classId,
    methodology_lesson_id: lessonIdMap.get(scheduledLesson.methodologyLessonId) ?? "",
    starts_at: scheduledLesson.runtimeShell.startsAt,
    format: scheduledLesson.runtimeShell.format,
    meeting_link:
      scheduledLesson.runtimeShell.format === "online"
        ? scheduledLesson.runtimeShell.meetingLink
        : null,
    place:
      scheduledLesson.runtimeShell.format === "offline"
        ? scheduledLesson.runtimeShell.place
        : null,
    runtime_status: scheduledLesson.runtimeShell.runtimeStatus,
    runtime_notes_summary: scheduledLesson.runtimeShell.runtimeNotesSummary ?? null,
    runtime_notes: scheduledLesson.runtimeNotes ?? null,
    outcome_notes: scheduledLesson.outcomeNotes ?? null,
  }));

  return {
    methodologyRow: {
      id: methodologyId,
      slug: lessonContentFixtureMethodology.slug,
      title: normalizeMethodologyDisplayTitle(lessonContentFixtureMethodology.title),
      short_description: lessonContentFixtureMethodology.shortDescription ?? null,
      metadata: lessonContentFixtureMethodology.metadata ?? {},
    },
    methodologyLessonRows,
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
    homeworkDefinitionRows,
    studentContentRows,
    scheduledLessonRows,
    // Backward compatibility for existing tests and tooling that are still single-lesson oriented.
    methodologyLessonRow: methodologyLessonRows[0],
    homeworkDefinitionRow: homeworkDefinitionRows[0],
    studentContentRow: studentContentRows[0],
    scheduledLessonRow: scheduledLessonRows[0],
  };
}

async function upsertMethodologyLessonFixtures(input: {
  resolvedMethodologyId: string;
  rows: FixtureBootstrapRows;
}) {
  const lessonIdMap = new Map<string, string>();

  for (const lessonRow of input.rows.methodologyLessonRows) {
    const existingMethodologyLesson = await adminRequest<MethodologyLessonIdRow[]>(
      `/rest/v1/methodology_lesson?select=id&methodology_id=eq.${input.resolvedMethodologyId}&module_index=eq.${lessonRow.module_index}&lesson_index=eq.${lessonRow.lesson_index}${lessonRow.unit_index === null ? "&unit_index=is.null" : `&unit_index=eq.${lessonRow.unit_index}`}&limit=1`,
      "GET",
    );

    const resolvedMethodologyLessonId = existingMethodologyLesson[0]?.id ?? lessonRow.id;
    lessonIdMap.set(lessonRow.fixtureLessonId, resolvedMethodologyLessonId);

    await adminRequest(
      "/rest/v1/methodology_lesson?on_conflict=methodology_id,module_index,unit_index,lesson_index",
      "POST",
      {
        payload: {
          id: resolvedMethodologyLessonId,
          title: lessonRow.title,
          module_index: lessonRow.module_index,
          unit_index: lessonRow.unit_index,
          lesson_index: lessonRow.lesson_index,
          vocabulary_summary: lessonRow.vocabulary_summary,
          phrase_summary: lessonRow.phrase_summary,
          estimated_duration_minutes: lessonRow.estimated_duration_minutes,
          readiness_status: lessonRow.readiness_status,
          methodology_id: input.resolvedMethodologyId,
        },
        extraHeaders: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      },
    );
  }

  return lessonIdMap;
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

  const lessonIdMap = await upsertMethodologyLessonFixtures({
    resolvedMethodologyId,
    rows,
  });

  const fixtureLessonIdByBootstrapLessonId = new Map(
    rows.methodologyLessonRows.map((lesson) => [lesson.id, lesson.fixtureLessonId]),
  );

  const blockRows = rows.blockRows.map((block) => ({
    ...block,
    methodology_lesson_id:
      lessonIdMap.get(
        fixtureLessonIdByBootstrapLessonId.get(block.methodology_lesson_id) ?? "",
      ) ?? block.methodology_lesson_id,
  }));

  const homeworkDefinitionRows = rows.homeworkDefinitionRows.map((homework) => {
    return {
      ...homework,
      methodology_lesson_id:
        lessonIdMap.get(
          fixtureLessonIdByBootstrapLessonId.get(homework.methodology_lesson_id) ?? "",
        ) ?? homework.methodology_lesson_id,
    };
  });

  const studentContentRows = rows.studentContentRows.map((studentContent) => {
    return {
      ...studentContent,
      methodology_lesson_id:
        lessonIdMap.get(
          fixtureLessonIdByBootstrapLessonId.get(studentContent.methodology_lesson_id) ??
            "",
        ) ?? studentContent.methodology_lesson_id,
    };
  });

  const scheduledLessonRows = rows.scheduledLessonRows.map((scheduledLesson) => ({
    id: scheduledLesson.id,
    class_id: scheduledLesson.class_id,
    methodology_lesson_id:
      lessonIdMap.get(scheduledLesson.fixtureMethodologyLessonId) ??
      scheduledLesson.methodology_lesson_id,
    starts_at: scheduledLesson.starts_at,
    format: scheduledLesson.format,
    meeting_link: scheduledLesson.meeting_link,
    place: scheduledLesson.place,
    runtime_status: scheduledLesson.runtime_status,
    runtime_notes_summary: scheduledLesson.runtime_notes_summary,
    runtime_notes: scheduledLesson.runtime_notes,
    outcome_notes: scheduledLesson.outcome_notes,
  }));

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
    "/rest/v1/methodology_lesson_homework?on_conflict=methodology_lesson_id",
    "POST",
    {
      payload: homeworkDefinitionRows,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  await adminRequest(
    "/rest/v1/methodology_lesson_student_content?on_conflict=methodology_lesson_id",
    "POST",
    {
      payload: studentContentRows,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  if (options?.includeDevScheduledLesson ?? true) {
    await adminRequest("/rest/v1/scheduled_lesson?on_conflict=id", "POST", {
      payload: scheduledLessonRows,
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    });
  }

  return {
    methodologyId: resolvedMethodologyId,
    methodologyLessonIds: Array.from(lessonIdMap.values()),
    blockCount: blockRows.length,
    scheduledLessonIds: scheduledLessonRows.map((item) => item.id),
  };
}
