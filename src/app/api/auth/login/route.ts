import { NextRequest, NextResponse } from "next/server";
import { AUTH_MESSAGES, ROUTES, isEmail } from "@/lib/auth";
import { afterLogin } from "@/lib/auth-redirects";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { writeAppSession } from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { loginPayloadSchema } from "@/lib/server/validation";
import {
  ensureUserPreference,
  findStudentAuthEmail,
  getUserContextById,
  resolvePostLoginRedirect,
  trySignInWithPassword,
  verifyUserPin,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

function isInfrastructureAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("supabase auth is not configured") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("invalid url")
  );
}

function fail(
  status = 401,
  message: string = AUTH_MESSAGES.invalidCredentials,
) {
  return apiError(status, message);
}

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "auth-login",
    limit: 8,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Слишком много попыток входа. Попробуйте позже." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let stage = "read-body";

  try {
    const parsed = await parseJsonWithSchema(
      req,
      loginPayloadSchema,
      AUTH_MESSAGES.invalidCredentials,
    );
    if (!parsed.ok) return parsed.response;
    const { identifier, secret } = parsed.data;

    let resolvedEmail = "";
    let candidateUserId: string | null = null;

    stage = "resolve-identifier";
    if (isEmail(identifier)) {
      resolvedEmail = identifier;
    } else {
      const studentMatch = await findStudentAuthEmail(identifier);
      if (!studentMatch) {
        return fail();
      }
      resolvedEmail = studentMatch.email;
      candidateUserId = studentMatch.userId;
    }

    stage = "password-login";
    const passwordSession = await trySignInWithPassword(resolvedEmail, secret);

    if (passwordSession?.user?.id) {
      const userId = passwordSession.user.id;
      stage = "write-session-password";
      await writeAppSession({
        uid: userId,
        email: passwordSession.user.email ?? null,
        fullName: passwordSession.user.user_metadata?.full_name ?? null,
      });

      stage = "ensure-user-preference-password";
      try {
        await ensureUserPreference(userId);
      } catch (error) {
        logger.error(
          "[auth-login] ensureUserPreference failed after successful password auth",
          { userId, error },
        );
      }

      stage = "resolve-post-login-route-password";
      const redirectTo = afterLogin(await resolvePostLoginRedirect(userId));
      return NextResponse.json({ redirectTo });
    }

    if (candidateUserId) {
      stage = "student-pin-verify";
      const pinOk = await verifyUserPin(candidateUserId, secret);
      if (pinOk) {
        stage = "load-student-context";
        const context = await getUserContextById(candidateUserId, {
          email: resolvedEmail,
        }).catch((error) => {
          logger.error(
            "[auth-login] getUserContextById failed after successful student pin verification, using fallback session context",
            { userId: candidateUserId, error },
          );
          return {
            userId: candidateUserId,
            email: resolvedEmail,
            fullName: null,
            actorKind: "student" as const,
            hasPin: true,
            parent: null,
            teacher: null,
            student: null,
            preference: null,
            selectedSchool: null,
          };
        });

        stage = "write-session-pin";
        await writeAppSession({
          uid: candidateUserId,
          email: context.email,
          fullName: context.fullName,
        });

        stage = "ensure-user-preference-pin";
        try {
          await ensureUserPreference(candidateUserId);
        } catch (error) {
          logger.error(
            "[auth-login] ensureUserPreference failed after successful pin auth",
            { userId: candidateUserId, error },
          );
        }

        return NextResponse.json({ redirectTo: afterLogin(ROUTES.dashboard) });
      }
    }

    return fail();
  } catch (error) {
    logger.error("[auth-login] unexpected error", { stage, error });

    if (stage === "write-session-password" || stage === "write-session-pin") {
      return fail(
        500,
        "Не удалось сохранить сессию входа. Попробуйте ещё раз.",
      );
    }

    if (isInfrastructureAuthError(error)) {
      return fail(503, AUTH_MESSAGES.temporarilyUnavailable);
    }

    if (
      stage === "resolve-identifier" ||
      stage === "password-login" ||
      stage === "student-pin-verify"
    ) {
      return fail(401, AUTH_MESSAGES.invalidCredentials);
    }

    return fail(503, AUTH_MESSAGES.temporarilyUnavailable);
  }
}
