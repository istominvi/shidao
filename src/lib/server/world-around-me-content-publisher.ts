import { createHash } from "node:crypto";
import { buildFixtureBootstrapRows } from "./lesson-content-bootstrap";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json | Json[];
  extraHeaders?: Record<string, string>;
};

type AdminRequest = <T>(
  path: string,
  method?: "GET" | "POST" | "PATCH",
  options?: RequestOptions,
) => Promise<T>;

type MethodologyIdRow = { id: string };
type LessonIdRow = { id: string };

type PublishResolution = "exact_id" | "position" | "title";

const WORLD_AROUND_ME_SLUG = "world-around-me";
const WORLD_AROUND_ME_LESSON_ONE_ID = "b62b2f3d-c16f-6f3a-4a90-c124439690cf";

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for world-around-me content publication.");
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for world-around-me content publication.");
  }
  return url;
}

async function adminRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
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

export async function resolveWorldAroundMeLessonOneId(input: {
  request?: AdminRequest;
  methodologyId: string;
  moduleIndex: number;
  lessonIndex: number;
  unitIndex: number | null;
  titleHint: string;
}): Promise<{ lessonId: string; resolution: PublishResolution }> {
  const request = input.request ?? adminRequest;

  const exact = await request<LessonIdRow[]>(
    `/rest/v1/methodology_lesson?select=id&id=eq.${WORLD_AROUND_ME_LESSON_ONE_ID}&methodology_id=eq.${input.methodologyId}&limit=1`,
    "GET",
  );
  if (exact[0]?.id) {
    return { lessonId: exact[0].id, resolution: "exact_id" };
  }

  const byPosition = await request<LessonIdRow[]>(
    `/rest/v1/methodology_lesson?select=id&methodology_id=eq.${input.methodologyId}&module_index=eq.${input.moduleIndex}&lesson_index=eq.${input.lessonIndex}${input.unitIndex === null ? "&unit_index=is.null" : `&unit_index=eq.${input.unitIndex}`}&limit=1`,
    "GET",
  );
  if (byPosition[0]?.id) {
    return { lessonId: byPosition[0].id, resolution: "position" };
  }

  const byTitle = await request<LessonIdRow[]>(
    `/rest/v1/methodology_lesson?select=id&methodology_id=eq.${input.methodologyId}&title=ilike.${encodeURIComponent(`%${input.titleHint}%`)}&limit=1`,
    "GET",
  );
  if (byTitle[0]?.id) {
    return { lessonId: byTitle[0].id, resolution: "title" };
  }

  throw new Error("Could not resolve world-around-me lesson 1 for content publication.");
}

export async function publishWorldAroundMeLessonOneContent(input?: {
  request?: AdminRequest;
}) {
  const request = input?.request ?? adminRequest;
  const rows = buildFixtureBootstrapRows();

  const methodologyRows = await request<MethodologyIdRow[]>(
    `/rest/v1/methodology?select=id&slug=eq.${encodeURIComponent(WORLD_AROUND_ME_SLUG)}&limit=1`,
    "GET",
  );
  const methodologyId = methodologyRows[0]?.id;
  if (!methodologyId) {
    throw new Error(`Methodology ${WORLD_AROUND_ME_SLUG} not found.`);
  }

  const resolved = await resolveWorldAroundMeLessonOneId({
    request,
    methodologyId,
    moduleIndex: rows.methodologyLessonRow.module_index,
    unitIndex: rows.methodologyLessonRow.unit_index,
    lessonIndex: rows.methodologyLessonRow.lesson_index,
    titleHint: "Животные на ферме",
  });

  const assetRows = rows.reusableAssetRows.map((asset) => ({
    ...asset,
    id: asset.id || stableUuid(`reusable_asset:${asset.slug}`),
  }));

  await request(
    "/rest/v1/reusable_asset?on_conflict=slug",
    "POST",
    {
      payload: assetRows,
      extraHeaders: { Prefer: "resolution=merge-duplicates,return=representation" },
    },
  );

  await request(
    "/rest/v1/methodology_lesson_homework?on_conflict=methodology_lesson_id",
    "POST",
    {
      payload: {
        ...rows.homeworkDefinitionRow,
        id: stableUuid(`methodology_lesson_homework:${resolved.lessonId}`),
        methodology_lesson_id: resolved.lessonId,
      },
      extraHeaders: { Prefer: "resolution=merge-duplicates,return=representation" },
    },
  );

  await request(
    "/rest/v1/methodology_lesson_student_content?on_conflict=methodology_lesson_id",
    "POST",
    {
      payload: {
        ...rows.studentContentRow,
        id: stableUuid(`methodology_lesson_student_content:${resolved.lessonId}`),
        methodology_lesson_id: resolved.lessonId,
      },
      extraHeaders: { Prefer: "resolution=merge-duplicates,return=representation" },
    },
  );

  return {
    methodologyId,
    methodologyLessonId: resolved.lessonId,
    resolution: resolved.resolution,
  };
}
