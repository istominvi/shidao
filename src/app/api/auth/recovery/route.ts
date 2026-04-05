import { NextRequest, NextResponse } from 'next/server';
import { afterConfirm } from '@/lib/auth-redirects';
import { isEmail } from '@/lib/auth';
import { getPublicSiteUrl, getSupabasePublicConfig } from '@/lib/server/auth-config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 });
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const redirectTo = new URL('/auth/confirm', getPublicSiteUrl());
    redirectTo.searchParams.set('next', afterConfirm('recovery'));

    await fetch(`${url}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        redirect_to: redirectTo.toString()
      }),
      cache: 'no-store'
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth-recovery] failed', error);
    return NextResponse.json({ error: 'Не удалось отправить письмо восстановления.' }, { status: 503 });
  }
}
