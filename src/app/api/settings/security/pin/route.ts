import { NextRequest, NextResponse } from "next/server";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import {
  getCurrentAccountAuthContext,
  setCurrentAccountPin,
  trySignInAccountWithPassword,
  verifyCurrentAccountPin,
} from "@/lib/server/account-auth";
import { isSessionRevoked, readAppSession } from "@/lib/server/app-session";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { requireSupabaseUserAccessToken } from "@/lib/server/supabase-user-session";
import { securityPinPayloadSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "settings-security-pin",
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Слишком много запросов. Повторите попытку позже." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const session = await readAppSession();
  if (!session) return apiError(401, "Не авторизовано.");

  const parsed = await parseJsonWithSchema(
    req,
    securityPinPayloadSchema,
    "PIN должен состоять из 4-8 цифр.",
  );
  if (!parsed.ok) return parsed.response;
  const { newPin, currentSecret } = parsed.data;
  if (!currentSecret) {
    return apiError(400, "Подтвердите действие текущим паролем или PIN.");
  }

  try {
    const accessToken = await requireSupabaseUserAccessToken();
    const context = await getCurrentAccountAuthContext(accessToken);
    if (
      context.authUserId !== session.uid ||
      isSessionRevoked(session.iat, context.sessionsInvalidBefore)
    ) {
      return apiError(401, "Требуется повторный вход.");
    }

    const passwordAuth = session.email
      ? await trySignInAccountWithPassword(session.email, currentSecret)
      : null;
    const passwordConfirmed = passwordAuth?.user?.id === session.uid;

    // A correct password is sufficient and must not increment the PIN failure
    // counter. Only consult the PIN verifier after password auth is rejected.
    const pinConfirmed = passwordConfirmed
      ? false
      : await verifyCurrentAccountPin(accessToken, currentSecret);
    if (!passwordConfirmed && !pinConfirmed) {
      return apiError(401, "Подтверждение не прошло.");
    }

    await setCurrentAccountPin(session.uid, newPin);
    return NextResponse.json({ ok: true });
  } catch {
    return apiError(503, "Не удалось сохранить PIN. Попробуйте позже.");
  }
}
