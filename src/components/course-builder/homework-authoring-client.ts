"use client";

import { z } from "zod";
import {
  lessonHomeworkSchema,
  type ClearLessonHomeworkInput,
  type ReplaceLessonHomeworkInput,
} from "@/modules/homework-authoring/contracts";
import type { LessonHomework } from "@/modules/homework-authoring/domain";

export type HomeworkAuthoringClientFailure =
  | "login"
  | "denied"
  | "stale"
  | "validation"
  | "invalid_response"
  | "unavailable";

export class HomeworkAuthoringClientError extends Error {
  constructor(
    readonly failure: HomeworkAuthoringClientFailure,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(
      failure === "stale"
        ? "Домашнее задание уже изменено в другой вкладке. Загрузите актуальную версию."
        : failure === "login"
          ? "Сессия завершилась. Войдите снова и повторите действие."
          : failure === "denied"
            ? "Урок не найден или недоступен."
            : failure === "validation"
              ? "Проверьте пункты домашнего задания."
              : "Не удалось сохранить домашнее задание. Проверьте соединение и повторите попытку.",
    );
    this.name = "HomeworkAuthoringClientError";
  }
}

const homeworkResponseSchema = z
  .object({ homework: lessonHomeworkSchema.nullable() })
  .strict();

function homeworkPath(lessonId: string) {
  return `/api/v2/lessons/${encodeURIComponent(lessonId)}/homework`;
}

function classifyFailure(status: number, code: string | null) {
  if (status === 401) return "login" as const;
  if (status === 403 || status === 404) return "denied" as const;
  if (status === 409 || code === "homework_revision_conflict") {
    return "stale" as const;
  }
  if (status === 400) return "validation" as const;
  return "unavailable" as const;
}

async function homeworkRequest(
  lessonId: string,
  init: RequestInit,
  fetchImplementation: typeof fetch,
) {
  let response: Response;
  try {
    response = await fetchImplementation(homeworkPath(lessonId), {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new HomeworkAuthoringClientError("unavailable", 0);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
        ? payload.code
        : null;
    throw new HomeworkAuthoringClientError(
      classifyFailure(response.status, code),
      response.status,
      code,
    );
  }
  return payload;
}

export async function loadLessonHomework(
  lessonId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<LessonHomework | null> {
  const payload = await homeworkRequest(
    lessonId,
    { method: "GET" },
    fetchImplementation,
  );
  const parsed = homeworkResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HomeworkAuthoringClientError("invalid_response", 200);
  }
  return parsed.data.homework;
}

export async function replaceLessonHomework(
  lessonId: string,
  input: ReplaceLessonHomeworkInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<LessonHomework> {
  const payload = await homeworkRequest(
    lessonId,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    fetchImplementation,
  );
  const parsed = homeworkResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.homework === null) {
    throw new HomeworkAuthoringClientError("invalid_response", 200);
  }
  return parsed.data.homework;
}

export async function clearLessonHomework(
  lessonId: string,
  input: ClearLessonHomeworkInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<LessonHomework> {
  const payload = await homeworkRequest(
    lessonId,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    fetchImplementation,
  );
  const parsed = homeworkResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.homework === null) {
    throw new HomeworkAuthoringClientError("invalid_response", 200);
  }
  return parsed.data.homework;
}
