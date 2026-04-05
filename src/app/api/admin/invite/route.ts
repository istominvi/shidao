import { NextRequest, NextResponse } from 'next/server';
import { ROUTES, isEmail } from '@/lib/auth';
import { getPublicSiteUrl } from '@/lib/server/auth-config';
import { readAppSession } from '@/lib/server/app-session';
import { getUserContextById, inviteUserByEmail } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await readAppSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    const context = await getUserContextById(session.uid, { email: session.email, fullName: session.fullName });
    if (context.actorKind !== 'adult') {
      return NextResponse.json({ error: 'Только взрослый аккаунт может отправлять приглашения.' }, { status: 403 });
    }

    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 });
    }

    const redirectTo = new URL('/auth/confirm', getPublicSiteUrl());
    redirectTo.searchParams.set('next', ROUTES.onboarding);

    await inviteUserByEmail({ email, redirectTo: redirectTo.toString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin-invite] failed', error);
    return NextResponse.json({ error: 'Не удалось отправить приглашение.' }, { status: 503 });
  }
}
