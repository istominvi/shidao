import { NextRequest, NextResponse } from 'next/server';
import { readAppSession } from '@/lib/server/app-session';
import { requestEmailChangeForUser } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

function getPublicSiteUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://shidao.ru';
  return candidate.replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const session = await readAppSession();
    if (!session?.uid || !session.email) {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    const body = (await req.json()) as { newEmail?: string; currentPassword?: string };
    const newEmail = (body.newEmail ?? '').trim().toLowerCase();
    const currentPassword = body.currentPassword ?? '';

    if (!newEmail || !/.+@.+\..+/.test(newEmail)) {
      return NextResponse.json({ error: 'Укажите корректный новый email.' }, { status: 400 });
    }

    if (!currentPassword) {
      return NextResponse.json({ error: 'Введите текущий пароль для подтверждения действия.' }, { status: 400 });
    }

    const redirectTo = new URL('/auth/confirm', getPublicSiteUrl());
    redirectTo.searchParams.set('next', '/settings/profile?emailChangeRequested=1');

    await requestEmailChangeForUser({
      currentEmail: session.email,
      currentPassword,
      newEmail,
      redirectTo: redirectTo.toString()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось запросить смену email.';
    const status = message.includes('подтвердить текущий пароль') ? 400 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
