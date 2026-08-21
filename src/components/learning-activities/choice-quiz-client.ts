"use client";

import {
  submitChoiceQuizAttemptResultSchema,
  type SubmitChoiceQuizAttemptInput,
} from "@/modules/choice-quiz/contracts";

export type ChoiceQuizSubmitFailure =
  "login" | "denied" | "stale" | "invalid_response" | "unavailable";

export class ChoiceQuizSubmitError extends Error {
  constructor(
    readonly failure: ChoiceQuizSubmitFailure,
    readonly status: number,
  ) {
    super(
      failure === "stale"
        ? "Экран урока изменился. Обновляем задание."
        : failure === "login"
          ? "Сессия завершилась. Проверяем доступ заново."
          : failure === "denied"
            ? "Задание больше недоступно. Проверяем экран урока."
            : "Не удалось сохранить ответ. Проверьте соединение и повторите отправку.",
    );
    this.name = "ChoiceQuizSubmitError";
  }
}

function submitPath(lessonRunId: string, issueRef: string) {
  return `/api/v2/me/live-runs/${encodeURIComponent(lessonRunId)}/activities/${encodeURIComponent(issueRef)}/attempts`;
}

export async function submitLearnerChoiceQuizAttempt(
  lessonRunId: string,
  issueRef: string,
  input: SubmitChoiceQuizAttemptInput,
  fetchImplementation: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetchImplementation(submitPath(lessonRunId, issueRef), {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ChoiceQuizSubmitError("unavailable", 0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      throw new ChoiceQuizSubmitError("login", response.status);
    }
    if (response.status === 403 || response.status === 404) {
      throw new ChoiceQuizSubmitError("denied", response.status);
    }
    if (response.status === 409) {
      throw new ChoiceQuizSubmitError("stale", response.status);
    }
    throw new ChoiceQuizSubmitError("unavailable", response.status);
  }

  const parsed = submitChoiceQuizAttemptResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ChoiceQuizSubmitError("invalid_response", response.status);
  }
  return parsed.data.execution;
}
