import { NextRequest, NextResponse } from "next/server";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import { RouterAiError } from "./routerai";

export class AiRequestLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Слишком много запросов к ИИ. Попробуйте немного позже.");
    this.name = "AiRequestLimitError";
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

export class AiApplyInFlightError extends Error {
  constructor() {
    super("Изменения ИИ уже применяются к этому курсу.");
    this.name = "AiApplyInFlightError";
  }
}

type RateBucket = { resetAt: number; count: number };

const rateByActor = new Map<string, RateBucket>();
const inFlightByActor = new Map<string, number>();
const applyingCourses = new Set<string>();

function hitActorRateLimit(options: {
  actorAuthUserId: string;
  scope: "course-plan" | "lesson-plan" | "assistant";
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const key = `${options.scope}:${options.actorAuthUserId.toLowerCase()}`;
  const current = rateByActor.get(key);
  if (!current || current.resetAt <= now) {
    rateByActor.set(key, { count: 1, resetAt: now + options.windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (current.count >= options.limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1_000),
      ),
    };
  }
  current.count += 1;
  return { limited: false, retryAfterSeconds: 0 };
}

export async function runBoundedAiRequest<T>(
  _request: NextRequest,
  options: {
    actorAuthUserId: string;
    scope: "course-plan" | "lesson-plan" | "assistant";
    limit: number;
    windowMs: number;
    maxInFlight?: number;
  },
  operation: () => Promise<T>,
) {
  const rate = hitActorRateLimit(options);
  if (rate.limited) {
    throw new AiRequestLimitError(rate.retryAfterSeconds);
  }

  const maxInFlight = options.maxInFlight ?? 2;
  const actorKey = options.actorAuthUserId.toLowerCase();
  const current = inFlightByActor.get(actorKey) ?? 0;
  if (current >= maxInFlight) throw new AiRequestLimitError(10);
  inFlightByActor.set(actorKey, current + 1);
  try {
    return await operation();
  } finally {
    const next = (inFlightByActor.get(actorKey) ?? 1) - 1;
    if (next <= 0) inFlightByActor.delete(actorKey);
    else inFlightByActor.set(actorKey, next);
  }
}

export async function runExclusiveAiApply<T>(
  actorAuthUserId: string,
  courseId: string,
  operation: () => Promise<T>,
) {
  const key = `${actorAuthUserId.toLowerCase()}:${courseId.toLowerCase()}`;
  if (applyingCourses.has(key)) throw new AiApplyInFlightError();
  applyingCourses.add(key);
  try {
    return await operation();
  } finally {
    applyingCourses.delete(key);
  }
}

export async function aiApiError(error: unknown) {
  if (error instanceof AiRequestLimitError) {
    return NextResponse.json(
      { error: error.message, code: "ai_rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      },
    );
  }

  if (error instanceof AiApplyInFlightError) {
    return NextResponse.json(
      { error: error.message, code: "ai_apply_in_flight" },
      { status: 409 },
    );
  }

  if (error instanceof RouterAiError) {
    const response = (() => {
      switch (error.code) {
        case "configuration":
          return {
            status: 503,
            code: "ai_not_configured",
            message:
              "ИИ пока не настроен. Ручное создание курса и уроков продолжает работать.",
          };
        case "invalid_request":
          return {
            status: 400,
            code: "ai_invalid_request",
            message: "Проверьте параметры запроса к ИИ.",
          };
        case "timeout":
          return {
            status: 504,
            code: "ai_timeout",
            message: "ИИ не ответил вовремя. Повторите попытку.",
          };
        case "aborted":
          return {
            status: 408,
            code: "ai_aborted",
            message: "Запрос к ИИ был отменён.",
          };
        case "http":
          if (error.status === 429) {
            return {
              status: 429,
              code: "ai_provider_rate_limited",
              message: "Провайдер ИИ временно ограничил запросы.",
            };
          }
          if (error.status === 401 || error.status === 403) {
            return {
              status: 503,
              code: "ai_provider_auth_failed",
              message:
                "Провайдер ИИ временно недоступен. Ручное редактирование продолжает работать.",
            };
          }
          return {
            status: 502,
            code: "ai_provider_error",
            message: "Провайдер ИИ временно не смог выполнить запрос.",
          };
        case "invalid_response":
        case "invalid_output":
          return {
            status: 502,
            code: "ai_invalid_output",
            message:
              "ИИ не смог подготовить корректный результат. Повторите попытку.",
          };
        case "network":
          return {
            status: 502,
            code: "ai_network_error",
            message: "Не удалось связаться с провайдером ИИ.",
          };
        default: {
          const exhaustive: never = error.code;
          return exhaustive;
        }
      }
    })();
    return NextResponse.json(
      {
        error: response.message,
        code: response.code,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      },
      {
        status: response.status,
        ...(response.status === 429
          ? { headers: { "Retry-After": "30" } }
          : {}),
      },
    );
  }

  return courseBuilderApiError(error);
}
