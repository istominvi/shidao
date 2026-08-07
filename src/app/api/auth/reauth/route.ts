import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/server/api";
import {
  getCurrentAccountAuthContext,
  trySignInAccountWithPassword,
  verifyCurrentAccountPin,
} from "@/lib/server/account-auth";
import {
  isSessionRevoked,
  readAppSession,
  writeAppSession,
} from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { requireSupabaseUserSession } from "@/lib/server/supabase-user-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "auth-reauth",
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Слишком много попыток. Попробуйте позже." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const session = await readAppSession();
  if (!session) return apiError(401, "Требуется повторный вход.");
  const body = (await req.json().catch(() => null)) as {
    secret?: unknown;
  } | null;
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!secret || secret.length > 256) {
    return apiError(400, "Введите текущий пароль или PIN.");
  }

  try {
    const userSession = await requireSupabaseUserSession();
    const context = await getCurrentAccountAuthContext(userSession.accessToken);
    if (
      context.authUserId !== session.uid ||
      isSessionRevoked(session.iat, context.sessionsInvalidBefore)
    ) {
      return apiError(401, "Требуется повторный вход.");
    }

    const passwordAuth = session.email
      ? await trySignInAccountWithPassword(session.email, secret)
      : null;
    if (passwordAuth && passwordAuth.user.id !== session.uid) {
      return apiError(401, "Подтверждение не прошло.");
    }
    const passwordConfirmed = passwordAuth?.user.id === session.uid;
    const pinConfirmed = passwordConfirmed
      ? false
      : await verifyCurrentAccountPin(userSession.accessToken, secret);
    if (!passwordConfirmed && !pinConfirmed) {
      return apiError(401, "Подтверждение не прошло.");
    }

    await writeAppSession({
      uid: session.uid,
      email: session.email,
      fullName: context.displayName,
      recoveryVerifiedAt: session.recoveryVerifiedAt,
      reauthenticatedAt: Date.now(),
      supabaseSession: userSession.session.supabaseSession,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[auth-reauth] failed", { userId: session.uid, error });
    return apiError(503, "Не удалось подтвердить действие. Попробуйте позже.");
  }
}
