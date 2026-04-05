import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase auth is not configured.');
  }

  return { url, anonKey };
}

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
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 });
    }

    const { url, anonKey } = getSupabaseConfig();
    const redirectTo = new URL('/auth/confirm', getPublicSiteUrl());
    redirectTo.searchParams.set('next', '/reset-password');

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
