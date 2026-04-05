import { NextRequest, NextResponse } from 'next/server';
import { clearAppSession, readAppSession, writeAppSession } from '@/lib/server/app-session';
import { updateAuthUserPasswordById } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

const RECOVERY_TTL_MS = 1000 * 60 * 30;

export async function POST(req: NextRequest) {
  try {
    const session = await readAppSession();
    if (!session?.uid || !session.recoveryVerifiedAt) {
      return NextResponse.json({ error: 'Сессия восстановления не найдена. Запросите письмо ещё раз.' }, { status: 401 });
    }

    if (Date.now() - session.recoveryVerifiedAt > RECOVERY_TTL_MS) {
      await clearAppSession();
      return NextResponse.json({ error: 'Сессия восстановления истекла. Запросите письмо повторно.' }, { status: 401 });
    }

    const body = (await req.json()) as { password?: string; confirmPassword?: string };
    const password = body.password ?? '';
    const confirmPassword = body.confirmPassword ?? '';

    if (password.length < 8) {
      return NextResponse.json({ error: 'Пароль должен содержать минимум 8 символов.' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Пароль и подтверждение не совпадают.' }, { status: 400 });
    }

    await updateAuthUserPasswordById(session.uid, password);

    await writeAppSession({
      uid: session.uid,
      email: session.email,
      fullName: session.fullName,
      recoveryVerifiedAt: null
    });

    return NextResponse.json({ ok: true, redirectTo: '/login?passwordReset=1' });
  } catch (error) {
    console.error('[auth-reset-password] failed', error);
    return NextResponse.json({ error: 'Не удалось обновить пароль.' }, { status: 503 });
  }
}
