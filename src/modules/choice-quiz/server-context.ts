import { NextResponse } from "next/server";
import { clearAppSession } from "@/lib/server/app-session";
import {
  isSupabaseUserReauthenticationRequiredError,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import { getActiveCourseBuilderContext } from "@/modules/course-builder/server-context";
import {
  decodeTrustedSupabaseSessionClaims,
  getLearnerLiveActor,
} from "@/modules/live-delivery/server-context";
import { ChoiceQuizValidationError } from "./contracts";
import { ChoiceQuizProjectionError, ChoiceQuizRepositoryError } from "./errors";
import {
  createChoiceQuizLearnerRepository,
  createChoiceQuizTeacherRepository,
} from "./repository";
import { createChoiceQuizService } from "./service";

export async function getLearnerChoiceQuizContext() {
  const actor = await getLearnerLiveActor();
  return {
    actor,
    service: createChoiceQuizService({
      learnerRepository: createChoiceQuizLearnerRepository(),
    }),
  };
}

export async function getTeacherChoiceQuizContext() {
  const { actor } = await getActiveCourseBuilderContext();
  const sessionClaims = decodeTrustedSupabaseSessionClaims(actor.accessToken);
  if (!sessionClaims || sessionClaims.authUserId !== actor.authUserId) {
    throw new SupabaseUserReauthenticationRequiredError();
  }
  return {
    service: createChoiceQuizService({
      teacherRepository: createChoiceQuizTeacherRepository({
        authUserId: actor.authUserId,
        supabaseSessionId: sessionClaims.sessionId,
      }),
    }),
  };
}

export async function readChoiceQuizJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ChoiceQuizValidationError("Ожидался JSON body.");
  }
}

export function choiceQuizJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function choiceQuizApiError(error: unknown) {
  if (
    isSupabaseUserReauthenticationRequiredError(error) ||
    (error instanceof ChoiceQuizRepositoryError && error.status === 401)
  ) {
    await clearAppSession();
    return choiceQuizJson(
      {
        error: "Войдите снова, чтобы продолжить live-занятие.",
        code: "choice_quiz_reauthentication_required",
        loginRequired: true,
      },
      { status: 401 },
    );
  }

  if (error instanceof ChoiceQuizValidationError) {
    return choiceQuizJson(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }

  if (error instanceof ChoiceQuizRepositoryError) {
    if (error.status === 404) {
      return choiceQuizJson(
        {
          error: "Вопрос не найден или недоступен.",
          code: "choice_quiz_not_found",
        },
        { status: 404 },
      );
    }
    if (error.status === 409) {
      return choiceQuizJson(
        {
          error:
            error.code === "choice_quiz_idempotency_conflict"
              ? "Этот ключ отправки уже использован для другого ответа."
              : "Состояние вопроса изменилось. Обновите занятие.",
          code: error.code,
        },
        { status: 409 },
      );
    }
    if (error.status === 400) {
      return choiceQuizJson(
        {
          error: "Проверьте выбранные варианты ответа.",
          code: "choice_quiz_validation_error",
        },
        { status: 400 },
      );
    }
  }

  if (error instanceof ChoiceQuizProjectionError) {
    return choiceQuizJson(
      {
        error: "Вопрос временно недоступен.",
        code: error.code,
      },
      { status: 503 },
    );
  }

  return choiceQuizJson(
    {
      error: "Сервис вопросов временно недоступен.",
      code: "choice_quiz_unavailable",
    },
    { status: 503 },
  );
}
