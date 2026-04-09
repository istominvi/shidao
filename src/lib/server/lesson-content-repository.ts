import type {
  Methodology,
  MethodologyLesson,
  ReusableAsset,
  ScheduledLesson,
  ScheduledLessonRuntimeShell,
} from "../lesson-content";
import {
  mapMethodologyLessonRowToDomain,
  mapMethodologyRowToDomain,
  mapReusableAssetRowsToDomain,
  mapScheduledLessonRowToDomain,
  type RowMethodologyLessonWithBlocks,
  type RowReusableAsset,
  type RowScheduledLesson,
} from "./lesson-content-mappers";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json;
  allowEmpty?: boolean;
  extraHeaders?: Record<string, string>;
};

type RowMethodology = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  metadata: Record<string, unknown> | null;
};

type RowClassTeacher = {
  class_id: string;
};

type RowClass = {
  id: string;
  name: string | null;
  methodology_id: string | null;
  methodology?: {
    id: string;
    title: string | null;
  } | null;
};

type RowTeacherClass = {
  class_id: string;
  class: {
    id: string;
    name: string | null;
    methodology_id: string | null;
    methodology?: {
      id: string;
      title: string | null;
    } | null;
  } | null;
};

type RowMethodologySummary = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
};

type RowClassStudentMembership = {
  class_id: string;
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    login: string | null;
  } | null;
};

type RowMethodologyLessonCatalog = {
  id: string;
  title: string;
  module_index: number;
  unit_index: number | null;
  lesson_index: number;
  methodology: {
    id: string;
    title: string | null;
  } | null;
};

export type CreateScheduledLessonAdminInput = {
  classId: string;
  methodologyLessonId: string;
  startsAt: string;
  runtimeStatus?: ScheduledLessonRuntimeShell["runtimeStatus"];
} & (
  | {
      format: "online";
      meetingLink: string;
      place?: never;
    }
  | {
      format: "offline";
      place: string;
      meetingLink?: never;
    }
);

export type UpdateScheduledLessonRuntimeNotesAdminInput = {
  scheduledLessonId: string;
  runtimeNotesSummary?: string;
  runtimeNotes?: string;
  outcomeNotes?: string;
  runtimeStatus?: ScheduledLessonRuntimeShell["runtimeStatus"];
};

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin lesson-content requests.",
    );
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required for lesson-content repository.",
    );
  }
  return url;
}

function isMissingMethodologyBindingColumnError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("methodology_id") &&
    (normalized.includes("column") ||
      normalized.includes("schema cache") ||
      normalized.includes("does not exist"))
  );
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
    const payloadError = (await response.json().catch(() => null)) as {
      message?: string;
      msg?: string;
    } | null;
    throw new Error(
      payloadError?.message ?? payloadError?.msg ?? "Supabase request failed.",
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    if (options?.allowEmpty) return null as T;
    throw new Error("Supabase returned an empty response.");
  }

  return JSON.parse(text) as T;
}

function methodologyLessonSelect() {
  return [
    "id",
    "methodology_id",
    "title",
    "module_index",
    "unit_index",
    "lesson_index",
    "vocabulary_summary",
    "phrase_summary",
    "estimated_duration_minutes",
    "readiness_status",
    "methodology:methodology_id(slug,title)",
    "blocks:methodology_lesson_block(id,block_type,sort_order,title,content,block_assets:methodology_lesson_block_asset(sort_order,reusable_asset_id,asset:reusable_asset_id(id,kind,title,description,source_url,file_ref,metadata)))",
  ].join(",");
}

export async function getMethodologyBySlugAdmin(
  slug: string,
): Promise<Methodology | null> {
  const rows = await adminRequest<RowMethodology[]>(
    `/rest/v1/methodology?select=id,slug,title,short_description,metadata&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    "GET",
  );

  if (!rows[0]) return null;
  return mapMethodologyRowToDomain(rows[0]);
}

export async function listMethodologyLessonsByMethodologyAdmin(
  methodologyId: string,
): Promise<MethodologyLesson[]> {
  const select = encodeURIComponent(methodologyLessonSelect());
  const rows = await adminRequest<RowMethodologyLessonWithBlocks[]>(
    `/rest/v1/methodology_lesson?select=${select}&methodology_id=eq.${methodologyId}&order=module_index.asc&order=unit_index.asc.nullslast&order=lesson_index.asc`,
  );

  return rows.map(mapMethodologyLessonRowToDomain);
}

export async function getMethodologyLessonByIdAdmin(
  lessonId: string,
): Promise<MethodologyLesson | null> {
  const select = encodeURIComponent(methodologyLessonSelect());
  const rows = await adminRequest<RowMethodologyLessonWithBlocks[]>(
    `/rest/v1/methodology_lesson?select=${select}&id=eq.${lessonId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapMethodologyLessonRowToDomain(rows[0]);
}

export async function getScheduledLessonByIdAdmin(
  scheduledLessonId: string,
): Promise<ScheduledLesson | null> {
  const rows = await adminRequest<RowScheduledLesson[]>(
    `/rest/v1/scheduled_lesson?select=id,class_id,methodology_lesson_id,starts_at,format,meeting_link,place,runtime_status,runtime_notes_summary,runtime_notes,outcome_notes&id=eq.${scheduledLessonId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapScheduledLessonRowToDomain(rows[0]);
}

export async function listScheduledLessonsForClassAdmin(
  classId: string,
): Promise<ScheduledLesson[]> {
  const rows = await adminRequest<RowScheduledLesson[]>(
    `/rest/v1/scheduled_lesson?select=id,class_id,methodology_lesson_id,starts_at,format,meeting_link,place,runtime_status,runtime_notes_summary,runtime_notes,outcome_notes&class_id=eq.${classId}&order=starts_at.asc`,
  );

  return rows.map(mapScheduledLessonRowToDomain);
}

export async function listScheduledLessonsForClassesAdmin(
  classIds: string[],
): Promise<ScheduledLesson[]> {
  const normalizedClassIds = Array.from(
    new Set(classIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (normalizedClassIds.length === 0) {
    return [];
  }

  const inFilter = encodeURIComponent(`(${normalizedClassIds.join(",")})`);
  const rows = await adminRequest<RowScheduledLesson[]>(
    `/rest/v1/scheduled_lesson?select=id,class_id,methodology_lesson_id,starts_at,format,meeting_link,place,runtime_status,runtime_notes_summary,runtime_notes,outcome_notes&class_id=in.${inFilter}&order=starts_at.desc`,
  );

  return rows.map(mapScheduledLessonRowToDomain);
}

export async function getFirstAssignedClassIdForTeacherAdmin(
  teacherId: string,
): Promise<string | null> {
  const rows = await adminRequest<RowClassTeacher[]>(
    `/rest/v1/class_teacher?select=class_id&teacher_id=eq.${teacherId}&limit=1`,
  );
  return rows[0]?.class_id ?? null;
}

export async function listAssignedClassIdsForTeacherAdmin(
  teacherId: string,
): Promise<string[]> {
  const rows = await adminRequest<RowClassTeacher[]>(
    `/rest/v1/class_teacher?select=class_id&teacher_id=eq.${teacherId}`,
  );

  return Array.from(
    new Set(rows.map((row) => row.class_id?.trim() ?? "").filter(Boolean)),
  );
}

export async function listMethodologyLessonsCatalogAdmin(): Promise<
  Array<{
    id: string;
    title: string;
    methodologyId: string | null;
    methodologyTitle: string | null;
    moduleIndex: number;
    unitIndex: number | null;
    lessonIndex: number;
  }>
> {
  const rows = await adminRequest<RowMethodologyLessonCatalog[]>(
    "/rest/v1/methodology_lesson?select=id,title,module_index,unit_index,lesson_index,methodology:methodology_id(id,title)&order=module_index.asc&order=unit_index.asc.nullslast&order=lesson_index.asc",
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    methodologyId: row.methodology?.id ?? null,
    methodologyTitle: row.methodology?.title?.trim() || null,
    moduleIndex: row.module_index,
    unitIndex: row.unit_index,
    lessonIndex: row.lesson_index,
  }));
}

export async function listMethodologiesAdmin(): Promise<
  Array<{ id: string; title: string; shortDescription: string | null }>
> {
  const rows = await adminRequest<RowMethodologySummary[]>(
    "/rest/v1/methodology?select=id,title,short_description&order=title.asc",
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title.trim(),
    shortDescription: row.short_description?.trim() || null,
  }));
}

export async function listTeacherClassesAdmin(
  teacherId: string,
): Promise<
  Array<{
    id: string;
    name: string | null;
    methodologyId: string | null;
    methodologyTitle: string | null;
  }>
> {
  let rows: RowTeacherClass[];
  try {
    rows = await adminRequest<RowTeacherClass[]>(
      `/rest/v1/class_teacher?select=class_id,class:class_id(id,name,methodology_id,methodology:methodology_id(id,title))&teacher_id=eq.${teacherId}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (!isMissingMethodologyBindingColumnError(message)) {
      throw error;
    }

    const fallbackRows = await adminRequest<
      Array<{ class_id: string; class: { id: string; name: string | null } | null }>
    >(
      `/rest/v1/class_teacher?select=class_id,class:class_id(id,name)&teacher_id=eq.${teacherId}`,
    );
    rows = fallbackRows.map((row) => ({
      class_id: row.class_id,
      class: row.class
        ? {
            ...row.class,
            methodology_id: null,
            methodology: null,
          }
        : null,
    }));
  }

  const classes = rows
    .map((row) => ({
      id: row.class?.id ?? row.class_id,
      name: row.class?.name?.trim() || null,
      methodologyId: row.class?.methodology_id ?? null,
      methodologyTitle: row.class?.methodology?.title?.trim() || null,
    }))
    .filter((row) => row.id);

  return Array.from(new Map(classes.map((row) => [row.id, row])).values());
}

export async function listStudentsForClassesAdmin(
  classIds: string[],
): Promise<Record<string, Array<{ id: string; fullName: string | null; login: string | null }>>> {
  const normalizedClassIds = Array.from(
    new Set(classIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (normalizedClassIds.length === 0) {
    return {};
  }

  const inFilter = encodeURIComponent(`(${normalizedClassIds.join(",")})`);
  const rows = await adminRequest<RowClassStudentMembership[]>(
    `/rest/v1/class_student?select=class_id,student:student_id(id,first_name,last_name,login)&class_id=in.${inFilter}`,
  );

  const byClass: Record<string, Array<{ id: string; fullName: string | null; login: string | null }>> = {};

  for (const classId of normalizedClassIds) {
    byClass[classId] = [];
  }

  for (const row of rows) {
    const classId = row.class_id?.trim();
    if (!classId || !row.student) continue;

    const fullName = `${row.student.first_name ?? ""} ${row.student.last_name ?? ""}`
      .trim() || null;

    byClass[classId] ??= [];
    byClass[classId].push({
      id: row.student.id,
      fullName,
      login: row.student.login?.trim() || null,
    });
  }

  return byClass;
}

export async function listClassIdsForStudentAdmin(
  studentId: string,
): Promise<string[]> {
  const rows = await adminRequest<Array<{ class_id: string }>>(
    `/rest/v1/class_student?select=class_id&student_id=eq.${studentId}`,
  );

  return Array.from(
    new Set(rows.map((row) => row.class_id?.trim() ?? "").filter(Boolean)),
  );
}

export async function getClassDisplayNameByIdAdmin(
  classId: string,
): Promise<string | null> {
  let rows: RowClass[];
  try {
    rows = await adminRequest<RowClass[]>(
      `/rest/v1/class?select=id,name,methodology_id,methodology:methodology_id(id,title)&id=eq.${classId}&limit=1`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (!isMissingMethodologyBindingColumnError(message)) {
      throw error;
    }
    const fallbackRows = await adminRequest<Array<{ id: string; name: string | null }>>(
      `/rest/v1/class?select=id,name&id=eq.${classId}&limit=1`,
    );
    rows = fallbackRows.map((row) => ({
      id: row.id,
      name: row.name,
      methodology_id: null,
      methodology: null,
    }));
  }
  return rows[0]?.name?.trim() || null;
}

export async function getClassByIdAdmin(classId: string): Promise<{
  id: string;
  name: string | null;
  methodologyId: string | null;
  methodologyTitle: string | null;
} | null> {
  let rows: RowClass[];
  try {
    rows = await adminRequest<RowClass[]>(
      `/rest/v1/class?select=id,name,methodology_id,methodology:methodology_id(id,title)&id=eq.${classId}&limit=1`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (!isMissingMethodologyBindingColumnError(message)) {
      throw error;
    }
    const fallbackRows = await adminRequest<Array<{ id: string; name: string | null }>>(
      `/rest/v1/class?select=id,name&id=eq.${classId}&limit=1`,
    );
    rows = fallbackRows.map((row) => ({
      id: row.id,
      name: row.name,
      methodology_id: null,
      methodology: null,
    }));
  }

  const classRow = rows[0];
  if (!classRow) {
    return null;
  }

  return {
    id: classRow.id,
    name: classRow.name?.trim() || null,
    methodologyId: classRow.methodology_id ?? null,
    methodologyTitle: classRow.methodology?.title?.trim() || null,
  };
}

export async function listReusableAssetsByIdsAdmin(
  assetIds: string[],
): Promise<ReusableAsset[]> {
  const normalizedIds = Array.from(
    new Set(assetIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (normalizedIds.length === 0) {
    return [];
  }

  const inFilter = encodeURIComponent(`(${normalizedIds.join(",")})`);
  const rows = await adminRequest<RowReusableAsset[]>(
    `/rest/v1/reusable_asset?select=id,kind,title,description,source_url,file_ref,metadata&id=in.${inFilter}`,
  );

  return mapReusableAssetRowsToDomain(rows);
}
export async function createScheduledLessonAdmin(
  input: CreateScheduledLessonAdminInput,
): Promise<ScheduledLesson> {
  const rows = await adminRequest<RowScheduledLesson[]>(
    "/rest/v1/scheduled_lesson",
    "POST",
    {
      payload: {
        class_id: input.classId,
        methodology_lesson_id: input.methodologyLessonId,
        starts_at: input.startsAt,
        format: input.format,
        meeting_link: input.format === "online" ? input.meetingLink : null,
        place: input.format === "offline" ? input.place : null,
        runtime_status: input.runtimeStatus ?? "planned",
      },
    },
  );

  if (!rows[0]) {
    throw new Error("Failed to create scheduled lesson.");
  }

  return mapScheduledLessonRowToDomain(rows[0]);
}

export async function updateScheduledLessonRuntimeNotesAdmin(
  input: UpdateScheduledLessonRuntimeNotesAdminInput,
): Promise<ScheduledLesson> {
  const rows = await adminRequest<RowScheduledLesson[]>(
    `/rest/v1/scheduled_lesson?id=eq.${input.scheduledLessonId}`,
    "PATCH",
    {
      payload: {
        ...(input.runtimeStatus ? { runtime_status: input.runtimeStatus } : {}),
        ...(input.runtimeNotesSummary !== undefined
          ? { runtime_notes_summary: input.runtimeNotesSummary }
          : {}),
        ...(input.runtimeNotes !== undefined
          ? { runtime_notes: input.runtimeNotes }
          : {}),
        ...(input.outcomeNotes !== undefined
          ? { outcome_notes: input.outcomeNotes }
          : {}),
      },
    },
  );

  if (!rows[0]) {
    throw new Error("Scheduled lesson not found for runtime notes update.");
  }

  return mapScheduledLessonRowToDomain(rows[0]);
}


export async function listMethodologiesWithSlugAdmin(): Promise<
  Array<{
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    metadata: Record<string, unknown> | null;
  }>
> {
  const rows = await adminRequest<RowMethodology[]>(
    "/rest/v1/methodology?select=id,slug,title,short_description,metadata&order=title.asc",
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title.trim(),
    shortDescription: row.short_description?.trim() || null,
    metadata: row.metadata ?? null,
  }));
}
