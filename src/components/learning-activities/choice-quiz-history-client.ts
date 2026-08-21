"use client";

import {
  choiceQuizTeacherHistorySchema,
  correctChoiceQuizEvaluationInputSchema,
  correctChoiceQuizEvaluationResultSchema,
  type ChoiceQuizTeacherHistory,
  type CorrectChoiceQuizEvaluationInput,
  type CorrectChoiceQuizEvaluationResult,
} from "@/modules/choice-quiz/contracts";

export class ChoiceQuizHistoryClientError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? "Сессия завершилась. Войдите снова, чтобы увидеть историю ответов."
        : status === 403 || status === 404
          ? "История ответов для этого проведения недоступна."
          : "Не удалось загрузить историю ответов. Проверьте соединение и повторите попытку.",
    );
    this.name = "ChoiceQuizHistoryClientError";
  }
}

export class ChoiceQuizCorrectionClientError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? "Сессия завершилась. Войдите снова, чтобы исправить оценку."
        : status === 403 || status === 404
          ? "Эта оценка больше недоступна для исправления."
          : status === 409
            ? "Оценка уже изменилась. Обновите историю и повторите действие."
            : status === 400
              ? "Проверьте результат и причину исправления."
              : "Не удалось сохранить исправление. Проверьте соединение и повторите попытку.",
    );
    this.name = "ChoiceQuizCorrectionClientError";
  }
}

export async function loadTeacherChoiceQuizHistory(
  lessonRunId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ChoiceQuizTeacherHistory> {
  let response: Response;
  try {
    response = await fetchImplementation(
      `/api/v2/lesson-runs/${encodeURIComponent(lessonRunId)}/choice-quiz-history`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      },
    );
  } catch {
    throw new ChoiceQuizHistoryClientError(0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ChoiceQuizHistoryClientError(response.status);
  }

  const parsed = choiceQuizTeacherHistorySchema.safeParse(payload);
  if (!parsed.success) {
    throw new ChoiceQuizHistoryClientError(response.status);
  }
  return parsed.data;
}

export async function correctTeacherChoiceQuizEvaluation(
  evaluationId: string,
  input: CorrectChoiceQuizEvaluationInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<CorrectChoiceQuizEvaluationResult> {
  const parsedInput = correctChoiceQuizEvaluationInputSchema.safeParse(input);
  if (!parsedInput.success) throw new ChoiceQuizCorrectionClientError(400);

  let response: Response;
  try {
    response = await fetchImplementation(
      `/api/v2/choice-quiz-evaluations/${encodeURIComponent(evaluationId)}/corrections`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedInput.data),
      },
    );
  } catch {
    throw new ChoiceQuizCorrectionClientError(0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ChoiceQuizCorrectionClientError(response.status);
  }

  const parsed = correctChoiceQuizEvaluationResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ChoiceQuizCorrectionClientError(response.status);
  }
  return parsed.data;
}
