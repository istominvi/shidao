import { NextRequest, NextResponse } from "next/server";
import { AUTH_MESSAGES, isEmail } from "@/lib/auth";
import { afterLogin } from "@/lib/auth-redirects";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { writeAppSession } from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { resolvePostLoginRedirectForContext } from "@/lib/server/post-login-redirect";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { loginPayloadSchema } from "@/lib/server/validation";
import {
  ensureUserPreference,
  findStudentAuthEmail,
  getUserContextById,
  trySignInWithPassword,
  verifyUserPin,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

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
      stage = "load-user-context-password";
      const context = await getUserContextById(userId, {
        email: passwordSession.user.email ?? resolvedEmail,
        fullName: passwordSession.user.user_metadata?.full_name ?? null,
        expectedActorKind: candidateUserId ? "student" : "adult",
      });

      stage = "write-session-password";
      await writeAppSession({
        uid: userId,
        email: context.email,
        fullName: context.fullName,
      });

      if (context.actorKind === "adult") {
        stage = "ensure-user-preference-password";
        try {
          await ensureUserPreference(userId);
        } catch (error) {
          logger.error(
            "[auth-login] ensureUserPreference failed after successful password auth",
            { userId, error },
          );
        }
      }

      stage = "resolve-post-login-route-password";
      const redirectTo = afterLogin(
        resolvePostLoginRedirectForContext({
          actorKind: context.actorKind,
          hasAnyAdultProfile: context.hasAnyAdultProfile,
          activeAdultProfile: context.activeProfile ?? context.availableAdultProfiles[0] ?? null,
        }),
      );
      return NextResponse.json({ redirectTo });
    }

    if (candidateUserId) {
      stage = "student-pin-verify";
      const pinOk = await verifyUserPin(candidateUserId, secret);
      if (pinOk) {
        stage = "load-student-context";
        const context = await getUserContextById(candidateUserId, {
          email: resolvedEmail,
          expectedActorKind: "student",
        });

        stage = "write-session-pin";
        await writeAppSession({
          uid: candidateUserId,
          email: context.email,
          fullName: context.fullName,
        });

        if (context.actorKind === "adult") {
          stage = "ensure-user-preference-pin";
          try {
            await ensureUserPreference(candidateUserId);
          } catch (error) {
            logger.error(
              "[auth-login] ensureUserPreference failed after successful pin auth",
              { userId: candidateUserId, error },
            );
          }
        }

        return NextResponse.json({
          redirectTo: afterLogin(
            resolvePostLoginRedirectForContext({
              actorKind: context.actorKind,
              hasAnyAdultProfile: context.hasAnyAdultProfile,
              activeAdultProfile:
                context.activeProfile ?? context.availableAdultProfiles[0] ?? null,
            }),
          ),
        });
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

    return fail(503, AUTH_MESSAGES.temporarilyUnavailable);
  }
}
