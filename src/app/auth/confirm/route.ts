import { NextRequest, NextResponse } from 'next/server';
import { ROUTES } from '@/lib/auth';

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

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type');
  const next = req.nextUrl.searchParams.get('next') ?? `${ROUTES.login}?confirmed=1`;
  const fallbackUrl = new URL(`${ROUTES.login}?confirmed=0`, getPublicSiteUrl());

  if (!tokenHash || !type) {
    return NextResponse.redirect(fallbackUrl);
  }

  try {
    const { url, anonKey } = getSupabaseConfig();
    const response = await fetch(`${url}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token_hash: tokenHash,
        type
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.redirect(fallbackUrl);
    }

    return NextResponse.redirect(new URL(next, getPublicSiteUrl()));
  } catch {
    return NextResponse.redirect(fallbackUrl);
  }
}

