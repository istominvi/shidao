import "server-only";

import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import { lessonHomeworkScopeSchema } from "./contracts";
import type { LessonHomeworkDraftItem, LessonHomeworkScope } from "./domain";

export const HOMEWORK_AUTHORING_RPC = {
  get: "get_my_lesson_homework",
  replace: "replace_my_lesson_homework",
} as const;

type RepositoryOptions = { fetcher?: typeof fetch };

export interface HomeworkAuthoringRepository {
  getScope(lessonId: string): Promise<LessonHomeworkScope>;
  replace(input: {
    lessonId: string;
    expectedRevision: number | null;
    items: LessonHomeworkDraftItem[];
  }): Promise<LessonHomeworkScope>;
}

type ErrorPayload = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
};

function repositoryFailure(status: number, payload: unknown) {
  const details =
    payload && typeof payload === "object" ? (payload as ErrorPayload) : null;
  const code = typeof details?.code === "string" ? details.code : null;
  const message =
    typeof details?.message === "string"
      ? details.message
      : typeof details?.error === "string"
        ? details.error
        : "lesson_homework_repository_error";
  const token = message.toLowerCase();

  if (code === "P0002" || token.includes("lesson_homework_not_found")) {
    return new CourseBuilderRepositoryError(
      "Урок не найден или недоступен.",
      404,
      "access_denied",
    );
  }
  if (code === "40001" || token.includes("lesson_homework_revision_conflict")) {
    return new CourseBuilderRepositoryError(
      "Домашнее задание уже изменено в другой вкладке.",
      409,
      "homework_revision_conflict",
    );
  }
  if (code === "22023" || token.includes("lesson_homework_item_invalid")) {
    return new CourseBuilderRepositoryError(
      "Проверьте пункты домашнего задания.",
      400,
      "validation_error",
    );
  }
  if (status === 401) {
    return new CourseBuilderRepositoryError(
      "Войдите снова, чтобы продолжить работу с домашним заданием.",
      401,
      code,
    );
  }
  if (status === 403) {
    return new CourseBuilderRepositoryError(
      "Урок не найден или недоступен.",
      404,
      "access_denied",
    );
  }
  return new CourseBuilderRepositoryError(
    "Хранилище домашнего задания временно недоступно.",
    status >= 500 ? 503 : 400,
    code ?? "homework_repository_error",
  );
}

export function createHomeworkAuthoringRepository(
  accessToken: string,
  options: RepositoryOptions = {},
): HomeworkAuthoringRepository {
  const { url, anonKey } = getSupabasePublicConfig();
  const fetcher = options.fetcher ?? fetch;

  async function rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<LessonHomeworkScope> {
    let response: Response;
    try {
      response = await fetcher(
        `${url.replace(/\/+$/, "")}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
          cache: "no-store",
        },
      );
    } catch {
      throw new CourseBuilderRepositoryError(
        "Не удалось связаться с хранилищем домашнего задания.",
        503,
        "homework_network_error",
      );
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) throw repositoryFailure(response.status, payload);
    const parsed = lessonHomeworkScopeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new CourseBuilderRepositoryError(
        `${functionName} вернул некорректный ответ.`,
        502,
        "homework_response_invalid",
      );
    }
    return parsed.data;
  }

  return {
    getScope(lessonId) {
      return rpc(HOMEWORK_AUTHORING_RPC.get, { p_lesson_id: lessonId });
    },
    replace(input) {
      return rpc(HOMEWORK_AUTHORING_RPC.replace, {
        p_lesson_id: input.lessonId,
        p_expected_revision: input.expectedRevision,
        p_items: input.items,
      });
    },
  };
}
