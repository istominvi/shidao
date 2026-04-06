import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/auth";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { getPublicSiteUrl } from "@/lib/server/auth-config";
import { readAppSession } from "@/lib/server/app-session";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { changeEmailPayloadSchema } from "@/lib/server/validation";
import { requestEmailChangeForUser } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "settings-email-change",
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

  try {
    const session = await readAppSession();
    if (!session?.uid || !session.email) {
      return apiError(401, "Требуется авторизация.");
    }

    const parsed = await parseJsonWithSchema(
      req,
      changeEmailPayloadSchema,
      "Проверьте корректность данных.",
    );
    if (!parsed.ok) return parsed.response;
    const { newEmail, currentPassword } = parsed.data;

    const redirectTo = new URL("/auth/confirm", getPublicSiteUrl());
    redirectTo.searchParams.set(
      "next",
      `${ROUTES.settingsProfile}?emailChangeRequested=1`,
    );

    await requestEmailChangeForUser({
      currentEmail: session.email,
      currentPassword,
      newEmail,
      redirectTo: redirectTo.toString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось запросить смену email.";
    const status = message.includes("подтвердить текущий пароль") ? 400 : 503;
    return apiError(status, message);
  }
}
