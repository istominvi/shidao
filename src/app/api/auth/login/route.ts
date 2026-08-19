import { NextRequest, NextResponse } from "next/server";
import { AUTH_MESSAGES, isEmail } from "@/lib/auth";
import { afterLogin } from "@/lib/auth-redirects";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import {
  buildAppSessionSupabaseTokens,
  writeAppSession,
} from "@/lib/server/app-session";
import {
  getCurrentAccountAuthContext,
  mintSupabaseSessionForAccount,
  resolveAccountLoginAlias,
  trySignInAccountWithPassword,
  verifyAccountPinCredential,
  type SupabaseAuthSession,
} from "@/lib/server/account-auth";
import { logger } from "@/lib/server/logger";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { loginPayloadSchema } from "@/lib/server/validation";

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

    let resolvedEmail = identifier;
    let aliasAuthUserId: string | null = null;

    stage = "resolve-identifier";
    if (!isEmail(identifier)) {
      const alias = await resolveAccountLoginAlias(identifier);
      if (!alias) {
        return fail();
      }
      resolvedEmail = alias.authEmail;
      aliasAuthUserId = alias.authUserId;
    }

    stage = "password-login";
    let authSession: SupabaseAuthSession | null =
      await trySignInAccountWithPassword(resolvedEmail, secret);

    if (
      authSession?.user?.id &&
      aliasAuthUserId &&
      authSession.user.id !== aliasAuthUserId
    ) {
      // Alias resolution and GoTrue must agree on the exact Account identity.
      return fail();
    }

    if (!authSession && aliasAuthUserId) {
      stage = "account-pin-verify";
      const verifiedAlias = await verifyAccountPinCredential(
        identifier,
        secret,
      );
      if (
        verifiedAlias?.authUserId !== aliasAuthUserId ||
        verifiedAlias.authEmail !== resolvedEmail
      ) {
        return fail();
      }

      stage = "mint-pin-user-session";
      authSession = await mintSupabaseSessionForAccount(verifiedAlias);
    }

    if (!authSession?.user?.id) return fail();

    stage = "load-account-context";
    const context = await getCurrentAccountAuthContext(
      authSession.access_token,
    );
    if (context.authUserId !== authSession.user.id) return fail();

    stage = "write-session";
    const supabaseSession = buildAppSessionSupabaseTokens({
      accessToken: authSession.access_token,
      refreshToken: authSession.refresh_token,
      expiresInSeconds: authSession.expires_in,
      expiresAtEpochSeconds: authSession.expires_at,
    });
    if (!supabaseSession?.accessToken || !supabaseSession.refreshToken) {
      throw new Error(
        "Supabase login did not return a renewable user session.",
      );
    }
    await writeAppSession({
      uid: context.authUserId,
      // Only the confirmed public Account address belongs in browser-visible
      // session projections. Synthetic learner auth aliases stay server-only.
      email: context.verifiedEmail,
      fullName: context.displayName,
      reauthenticatedAt: Date.now(),
      supabaseSession,
    });

    return NextResponse.json({ redirectTo: afterLogin() });
  } catch (error) {
    logger.error("[auth-login] unexpected error", { stage, error });

    if (stage === "write-session") {
      return fail(
        500,
        "Не удалось сохранить сессию входа. Попробуйте ещё раз.",
      );
    }

    return fail(503, AUTH_MESSAGES.temporarilyUnavailable);
  }
}
