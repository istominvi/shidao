import { NextRequest, NextResponse } from "next/server";
import { afterConfirm } from "@/lib/auth-redirects";
import { isEmail } from "@/lib/auth";
import {
  getPublicSiteUrl,
  getSupabasePublicConfig,
} from "@/lib/server/auth-config";
import { logger } from "@/lib/server/logger";
import { hitRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "auth-recovery",
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!isEmail(email) || email.length > 254) {
      return NextResponse.json(
        { error: "Укажите корректный email." },
        { status: 400 },
      );
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const redirectTo = new URL("/auth/confirm", getPublicSiteUrl());
    redirectTo.searchParams.set("next", afterConfirm("recovery"));

    const response = await fetch(`${url}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        redirect_to: redirectTo.toString(),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      logger.error("[auth-recovery] supabase /recover rejected", {
        status: response.status,
      });
      // 5xx — реальный сбой доставки (SMTP/инфраструктура). Несуществующий
      // email GoTrue и так отдаёт 200, поэтому 503 здесь не раскрывает,
      // зарегистрирован ли адрес, но честно сообщает о сбое и не врёт об успехе.
      if (response.status >= 500) {
        return NextResponse.json(
          {
            error:
              "Не удалось отправить письмо восстановления. Попробуйте позже.",
          },
          { status: 503 },
        );
      }
      // 4xx (например, превышение частоты отправки) — детали не раскрываем,
      // отвечаем как при успехе, чтобы сохранить анти-энумерацию.
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[auth-recovery] failed", { error });
    return NextResponse.json(
      { error: "Не удалось отправить письмо восстановления." },
      { status: 503 },
    );
  }
}
