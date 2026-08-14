import { NextRequest, NextResponse } from "next/server";
import { profileSettingsStatusHref } from "@/lib/navigation/profile-nav";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { getPublicSiteUrl } from "@/lib/server/auth-config";
import { requestCurrentAccountEmailChange } from "@/lib/server/account-auth";
import { readAppSession } from "@/lib/server/app-session";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { changeEmailPayloadSchema } from "@/lib/server/validation";

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
      profileSettingsStatusHref("emailChangeRequested"),
    );

    await requestCurrentAccountEmailChange({
      actorAuthUserId: session.uid,
      currentEmail: session.email,
      currentPassword,
      newEmail,
      redirectTo: redirectTo.toString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const invalidCredential =
      error instanceof Error &&
      error.message === "Не удалось подтвердить текущий пароль.";
    return apiError(
      invalidCredential ? 400 : 503,
      invalidCredential
        ? "Не удалось подтвердить текущий пароль."
        : "Не удалось запросить смену email.",
    );
  }
}
