import { NextResponse } from "next/server";
import {
  clearAppSession,
  isSessionRevoked,
  readAppSession,
} from "@/lib/server/app-session";
import {
  isSupabaseUserReauthenticationRequiredError,
  requireSupabaseUserAccessToken,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "./contracts";
import type { CourseBuilderActor } from "./domain";
import {
  CourseBuilderRepositoryError,
  createCourseBuilderRepository,
} from "./repository";
import { createCourseBuilderService } from "./service";

export async function getCourseBuilderContext() {
  const session = await readAppSession();
  if (!session) throw new SupabaseUserReauthenticationRequiredError();
  const accessToken = await requireSupabaseUserAccessToken();
  const repository = createCourseBuilderRepository(accessToken);
  const sessionsInvalidBefore = await repository.getSessionInvalidBefore();
  if (isSessionRevoked(session.iat, sessionsInvalidBefore)) {
    throw new SupabaseUserReauthenticationRequiredError();
  }
  const actor: CourseBuilderActor = {
    authUserId: session.uid,
    accessToken,
  };
  return {
    actor,
    service: createCourseBuilderService({ repository }),
  };
}

export async function courseBuilderApiError(error: unknown) {
  if (isSupabaseUserReauthenticationRequiredError(error)) {
    // Prevent /courses -> /login -> authenticated-layout redirect loops for a
    // legacy app cookie or an invalid Supabase refresh token.
    await clearAppSession();
    return NextResponse.json(
      { error: error.message, code: error.code, loginRequired: true },
      { status: 401 },
    );
  }
  if (error instanceof CourseBuilderValidationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }
  if (error instanceof CourseBuilderAccessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 404 },
    );
  }
  if (error instanceof CourseBuilderConflictError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 409 },
    );
  }
  if (error instanceof CourseBuilderRepositoryError) {
    if (error.status === 401) {
      await clearAppSession();
      return NextResponse.json(
        {
          error: "Войдите снова, чтобы продолжить работу с курсами.",
          code: error.code ?? "repository_unauthorized",
          loginRequired: true,
        },
        { status: 401 },
      );
    }
    const status = [400, 403, 404, 409].includes(error.status)
      ? error.status
      : 503;
    return NextResponse.json(
      {
        error:
          status === 503
            ? "Не удалось связаться с хранилищем курсов."
            : error.message,
        code: error.code ?? "repository_error",
      },
      { status },
    );
  }
  return NextResponse.json(
    { error: "Не удалось выполнить операцию с курсом." },
    { status: 500 },
  );
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new CourseBuilderValidationError("Ожидался JSON body.");
  }
}
