import { NextRequest, NextResponse } from "next/server";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { readAppSession } from "@/lib/server/app-session";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { securityPinPayloadSchema } from "@/lib/server/validation";
import {
  hasUserPin,
  setUserPin,
  trySignInWithPassword,
  verifyUserPin,
} from "@/lib/server/supabase-admin";

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

  const alreadyConfigured = await hasUserPin(session.uid);
  if (alreadyConfigured) {
    if (!currentSecret) {
      return apiError(400, "Нужно подтвердить текущим паролем или PIN.");
    }

    const passwordAuth = session.email
      ? await trySignInWithPassword(session.email, currentSecret)
      : null;
    const pinAuth = await verifyUserPin(session.uid, currentSecret);

    if (!passwordAuth && !pinAuth) {
      return apiError(401, "Подтверждение не прошло.");
    }
  }

  await setUserPin(session.uid, newPin);
  return NextResponse.json({ ok: true });
}
