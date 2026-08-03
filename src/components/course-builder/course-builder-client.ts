"use client";

import { ROUTES } from "@/lib/auth";
import type {
  AssembleCourseResult,
  CourseAsset,
  CourseSummary,
  CourseWorkspace,
  PreparedCourseAttachment,
  StudentScreenCourse,
} from "@/modules/course-builder/domain";
import type {
  CourseDraftInput,
  PrepareCourseAttachmentInput,
} from "@/modules/course-builder/contracts";

type CourseBuilderErrorPayload = {
  error?: string;
  code?: string;
  loginRequired?: boolean;
};

export class CourseBuilderClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "CourseBuilderClientError";
    this.status = status;
    this.code = code ?? null;
  }
}

function fallbackErrorMessage(status: number) {
  if (status === 401) return "Сессия истекла. Войдите снова.";
  if (status === 403 || status === 404) {
    return "Курс не найден или недоступен.";
  }
  if (status >= 500) {
    return "Сервис курсов временно недоступен. Попробуйте ещё раз.";
  }
  return "Не удалось выполнить операцию с курсом.";
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
}

export async function courseBuilderRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: init.credentials ?? "same-origin",
    });
  } catch {
    throw new CourseBuilderClientError(
      "Не удалось связаться с сервисом курсов. Проверьте соединение и попробуйте ещё раз.",
      0,
      "network_error",
    );
  }
  const payload = (await response.json().catch(() => null)) as
    CourseBuilderErrorPayload | T | null;

  if (!response.ok) {
    const errorPayload = payload as CourseBuilderErrorPayload | null;
    if (errorPayload?.loginRequired) redirectToLogin();
    throw new CourseBuilderClientError(
      errorPayload?.error ?? fallbackErrorMessage(response.status),
      response.status,
      errorPayload?.code,
    );
  }

  return payload as T;
}

export async function loadCourseWorkspace(
  courseId: string,
): Promise<CourseWorkspace> {
  const payload = await courseBuilderRequest<{ course: CourseWorkspace }>(
    `/api/v2/courses/${encodeURIComponent(courseId)}`,
    { cache: "no-store" },
  );
  return payload.course;
}

export async function loadStudentScreenPreview(
  courseId: string,
): Promise<StudentScreenCourse> {
  const payload = await courseBuilderRequest<{ course: StudentScreenCourse }>(
    `/api/v2/courses/${encodeURIComponent(courseId)}/student-preview`,
    { cache: "no-store" },
  );
  return payload.course;
}

export async function createCourseDraft(input: CourseDraftInput) {
  const payload = await courseBuilderRequest<{ course: CourseSummary }>(
    "/api/v2/courses",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return payload.course;
}

export async function prepareCourseAttachment(
  courseId: string,
  input: PrepareCourseAttachmentInput,
) {
  const payload = await courseBuilderRequest<{
    attachment: PreparedCourseAttachment;
  }>(`/api/v2/courses/${encodeURIComponent(courseId)}/attachments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.attachment;
}

export async function uploadPreparedCourseAttachment(
  prepared: PreparedCourseAttachment,
  file: File,
) {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file, file.name);

  let response: Response;
  try {
    response = await fetch(prepared.upload.signedUrl, {
      method: "PUT",
      headers: { "x-upsert": "false" },
      body: formData,
    });
  } catch {
    throw new CourseBuilderClientError(
      "Не удалось связаться с приватным Storage. Проверьте соединение и попробуйте ещё раз.",
      0,
      "storage_network_error",
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    throw new CourseBuilderClientError(
      payload?.message ??
        payload?.error ??
        "Не удалось загрузить файл в Storage.",
      response.status,
      "storage_upload_failed",
    );
  }
}

export async function completeCourseAttachment(
  courseId: string,
  assetId: string,
) {
  const payload = await courseBuilderRequest<{ asset: CourseAsset }>(
    `/api/v2/courses/${encodeURIComponent(courseId)}/attachments/${encodeURIComponent(assetId)}/complete`,
    { method: "POST" },
  );
  return payload.asset;
}

export async function assembleCourseDraft(courseId: string) {
  const payload = await courseBuilderRequest<{ result: AssembleCourseResult }>(
    `/api/v2/courses/${encodeURIComponent(courseId)}/assemble`,
    { method: "POST" },
  );
  return payload.result;
}
