import { NextRequest, NextResponse } from "next/server";
import { afterConfirm, afterSignup } from "@/lib/auth-redirects";
import { isEmail } from "@/lib/auth";
import {
  getPublicSiteUrl,
  getSupabasePublicConfig,
  resolveSafeAuthRedirect,
} from "@/lib/server/auth-config";
import {
  buildAppSessionSupabaseTokens,
  writeAppSession,
} from "@/lib/server/app-session";
import { getCurrentAccountAuthContext } from "@/lib/server/account-auth";
import { logger } from "@/lib/server/logger";
import { hitRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

type Payload = {
  name?: string;
  email?: string;
  password?: string;
  next?: string;
};

type SupabaseSignupResponse = {
  message?: string;
  msg?: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_in?: number | null;
  expires_at?: number | null;
  user?: { id?: string | null } | null;
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
  const rateLimit = hitRateLimit(req, {
    key: "auth-signup",
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
    const body = (await req.json()) as Payload;
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const next = resolveSafeAuthRedirect(
      typeof body.next === "string" ? body.next : null,
      afterConfirm("signup"),
    );

    if (
      !name ||
      name.length > 160 ||
      !isEmail(email) ||
      email.length > 254 ||
      password.length < 8 ||
      password.length > 256
    ) {
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
    emailRedirectTo.searchParams.set("next", next);

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

    const payload = (await response
      .json()
      .catch(() => null)) as SupabaseSignupResponse | null;

    if (!response.ok) {
      return NextResponse.json(
        { error: mapSignupError(payload?.message ?? payload?.msg ?? "") },
        { status: 400 },
      );
    }

    let hasImmediateSession = false;
    if (payload?.user?.id && payload.access_token && payload.refresh_token) {
      try {
        const context = await getCurrentAccountAuthContext(
          payload.access_token,
        );
        const supabaseSession = buildAppSessionSupabaseTokens({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          expiresInSeconds: payload.expires_in,
          expiresAtEpochSeconds: payload.expires_at,
        });
        if (
          context.authUserId === payload.user.id &&
          supabaseSession?.accessToken &&
          supabaseSession.refreshToken
        ) {
          await writeAppSession({
            uid: context.authUserId,
            email: context.verifiedEmail,
            fullName: context.displayName,
            reauthenticatedAt: Date.now(),
            supabaseSession,
          });
          hasImmediateSession = true;
        }
      } catch (error) {
        // The Account exists even if the optional immediate-session bootstrap
        // fails; preserve signup success and send the user through login.
        logger.warn("[auth-signup] immediate session unavailable", { error });
      }
    }

    const requiresEmailConfirmation =
      !autoConfirmEnabled && !hasImmediateSession;

    return NextResponse.json({
      ok: true,
      requiresEmailConfirmation,
      redirectTo: afterSignup({
        requiresEmailConfirmation,
        email,
        next,
        hasSession: hasImmediateSession,
      }),
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
