import { NextRequest, NextResponse } from "next/server";
import { afterRecovery } from "@/lib/auth-redirects";
import {
  getCurrentAccountAuthContext,
  revokeAccountSessionsAdmin,
  updateCurrentAccountPassword,
} from "@/lib/server/account-auth";
import {
  clearAppSession,
  isSessionRevoked,
  readAppSession,
} from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { requireSupabaseUserSession } from "@/lib/server/supabase-user-session";

export const runtime = "nodejs";

const RECOVERY_TTL_MS = 1000 * 60 * 30;

export async function POST(req: NextRequest) {
  try {
    // Recovery подтверждается через /auth/confirm и фиксируется во внутренней app-сессии.
    // Это намеренное исключение: здесь не используем supabase-js client state, чтобы flow был единообразно серверным.
    const session = await readAppSession();
    if (!session?.uid || !session.recoveryVerifiedAt) {
      return NextResponse.json(
        {
          error: "Сессия восстановления не найдена. Запросите письмо ещё раз.",
        },
        { status: 401 },
      );
    }

    if (Date.now() - session.recoveryVerifiedAt > RECOVERY_TTL_MS) {
      await clearAppSession();
      return NextResponse.json(
        { error: "Сессия восстановления истекла. Запросите письмо повторно." },
        { status: 401 },
      );
    }

    const body = (await req.json()) as {
      password?: string;
      confirmPassword?: string;
    };
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (password.length < 8 || password.length > 256) {
      return NextResponse.json(
        { error: "Пароль должен содержать от 8 до 256 символов." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Пароль и подтверждение не совпадают." },
        { status: 400 },
      );
    }

    const userSession = await requireSupabaseUserSession();
    const context = await getCurrentAccountAuthContext(userSession.accessToken);
    if (
      context.authUserId !== session.uid ||
      isSessionRevoked(session.iat, context.sessionsInvalidBefore)
    ) {
      await clearAppSession();
      return NextResponse.json(
        { error: "Сессия восстановления истекла. Запросите письмо повторно." },
        { status: 401 },
      );
    }

    await updateCurrentAccountPassword(userSession.accessToken, password);

    // Password reset is not reported as complete until every previously issued
    // app session is behind the server-side cutoff. A failed cutoff update is a
    // security failure, not a best-effort warning.
    try {
      await revokeAccountSessionsAdmin(session.uid, new Date());
    } catch (error) {
      logger.error("[auth-reset-password] failed to revoke prior sessions", {
        userId: session.uid,
        error,
      });
      await clearAppSession();
      return NextResponse.json(
        {
          error:
            "Пароль обновлён, но завершить старые сессии не удалось. Войдите с новым паролем и повторите выход со всех устройств.",
        },
        { status: 503 },
      );
    }

    await clearAppSession();

    return NextResponse.json({ ok: true, redirectTo: afterRecovery() });
  } catch (error) {
    logger.error("[auth-reset-password] failed", { error });
    return NextResponse.json(
      { error: "Не удалось обновить пароль." },
      { status: 503 },
    );
  }
}
