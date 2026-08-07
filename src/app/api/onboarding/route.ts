import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/auth";
import { apiError } from "@/lib/server/api";
import {
  getCurrentAccountAuthContext,
  updateCurrentAccountProfile,
} from "@/lib/server/account-auth";
import {
  clearAppSession,
  isSessionRevoked,
  readAppSession,
} from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { requireSupabaseUserAccessToken } from "@/lib/server/supabase-user-session";

export const runtime = "nodejs";

const LOCALE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const TIMEZONE_PATTERN = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/;

export async function POST(req: NextRequest) {
  const session = await readAppSession();
  if (!session) return apiError(401, "Не авторизовано.");

  const body = (await req.json().catch(() => null)) as {
    displayName?: unknown;
    locale?: unknown;
    timezone?: unknown;
  } | null;
  const displayName =
    typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const locale = typeof body?.locale === "string" ? body.locale.trim() : "";
  const timezone =
    typeof body?.timezone === "string" ? body.timezone.trim() : "";
  if (
    displayName.length < 1 ||
    displayName.length > 160 ||
    !LOCALE_PATTERN.test(locale) ||
    timezone.length > 64 ||
    !TIMEZONE_PATTERN.test(timezone)
  ) {
    return apiError(400, "Проверьте имя, язык и часовой пояс.");
  }

  try {
    const accessToken = await requireSupabaseUserAccessToken();
    const context = await getCurrentAccountAuthContext(accessToken);
    if (
      context.authUserId !== session.uid ||
      isSessionRevoked(session.iat, context.sessionsInvalidBefore)
    ) {
      await clearAppSession();
      return apiError(401, "Требуется повторный вход.");
    }
    await updateCurrentAccountProfile(accessToken, {
      displayName,
      locale,
      timezone,
    });

    return NextResponse.json({ redirectTo: ROUTES.courses });
  } catch (error) {
    logger.error("[api/onboarding] Account update failed", {
      userId: session.uid,
      error,
    });
    return apiError(503, "Не удалось сохранить профиль. Попробуйте позже.");
  }
}
