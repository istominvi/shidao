import { NextRequest, NextResponse } from "next/server";
import { afterConfirm, afterSignup } from "@/lib/auth-redirects";
import {
  getPublicSiteUrl,
  getSupabasePublicConfig,
} from "@/lib/server/auth-config";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

type Payload = {
  name?: string;
  email?: string;
  password?: string;
};

function isEmailAutoconfirmEnabled() {
  return (
    String(process.env.ENABLE_EMAIL_AUTOCONFIRM ?? "").toLowerCase() === "true"
  );
}

function mapSignupError(rawMessage: string) {
  const message = rawMessage.toLowerCase();
  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already been registered")
  ) {
    return "Аккаунт с таким email уже существует. Попробуйте выполнить вход.";
  }
  if (message.includes("password")) {
    return "Пароль не соответствует требованиям безопасности.";
  }
  if (message.includes("invalid email")) {
    return "Укажите корректный email.";
  }

  return "Не удалось завершить регистрацию. Попробуйте ещё раз.";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        {
          error: "Укажите имя, корректный email и пароль не короче 8 символов.",
        },
        { status: 400 },
      );
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const autoConfirmEnabled = isEmailAutoconfirmEnabled();
    const emailRedirectTo = new URL("/auth/confirm", getPublicSiteUrl());
    emailRedirectTo.searchParams.set("next", afterConfirm("signup"));

    const response = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: { full_name: name },
        email_redirect_to: emailRedirectTo.toString(),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        msg?: string;
      } | null;
      return NextResponse.json(
        { error: mapSignupError(payload?.message ?? payload?.msg ?? "") },
        { status: 400 },
      );
    }

    if (autoConfirmEnabled) {
      return NextResponse.json({
        ok: true,
        requiresEmailConfirmation: false,
        redirectTo: afterSignup({ requiresEmailConfirmation: false, email }),
      });
    }

    return NextResponse.json({
      ok: true,
      requiresEmailConfirmation: true,
      redirectTo: afterSignup({ requiresEmailConfirmation: true, email }),
    });
  } catch (error) {
    logger.error("[auth-signup] failed", { error });
    return NextResponse.json(
      {
        error: "Сервис регистрации временно недоступен. Попробуйте чуть позже.",
      },
      { status: 503 },
    );
  }
}
