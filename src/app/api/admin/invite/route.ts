import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/auth";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { getPublicSiteUrl } from "@/lib/server/auth-config";
import { readAppSession } from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { invitePayloadSchema } from "@/lib/server/validation";
import {
  getUserContextById,
  inviteUserByEmail,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "admin-invite",
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
    if (!session?.uid) {
      return apiError(401, "Требуется авторизация.");
    }

    const context = await getUserContextById(session.uid, {
      email: session.email,
      fullName: session.fullName,
    });
    if (context.actorKind !== "adult") {
      return apiError(403, "Только взрослый аккаунт может отправлять приглашения.");
    }

    const parsed = await parseJsonWithSchema(
      req,
      invitePayloadSchema,
      "Укажите корректный email.",
    );
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    const redirectTo = new URL("/auth/confirm", getPublicSiteUrl());
    redirectTo.searchParams.set("next", ROUTES.onboarding);

    await inviteUserByEmail({ email, redirectTo: redirectTo.toString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[admin-invite] failed", { error });
    return apiError(503, "Не удалось отправить приглашение.");
  }
}
