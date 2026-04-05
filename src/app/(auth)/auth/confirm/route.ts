import { NextRequest, NextResponse } from 'next/server';
import { ROUTES } from '@/lib/auth';
import { getPublicSiteUrl, getSupabasePublicConfig, resolveSafeAuthRedirect } from '@/lib/server/auth-config';
import { writeAppSession } from '@/lib/server/app-session';

export const runtime = 'nodejs';
const ALLOWED_TYPES = new Set(['signup', 'email', 'recovery', 'invite', 'email_change']);

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const rawType = (req.nextUrl.searchParams.get('type') ?? '').toLowerCase();
  const type = rawType === 'email/signup' ? 'signup' : rawType;
  const next = req.nextUrl.searchParams.get('next');
  const fallbackUrl = new URL(`${ROUTES.login}?confirmed=0`, getPublicSiteUrl());

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(fallbackUrl);
  }

  const fallbackByType: Record<string, string> = {
    signup: `${ROUTES.login}?confirmed=1`,
    email: `${ROUTES.login}?confirmed=1`,
    recovery: ROUTES.resetPassword,
    invite: ROUTES.onboarding,
    email_change: `${ROUTES.settingsProfile}?emailChanged=1`
  };

  const redirectPath = resolveSafeAuthRedirect(next, fallbackByType[type] ?? `${ROUTES.login}?confirmed=1`);

  try {
    const { url, anonKey } = getSupabasePublicConfig();
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

    const payload = (await response.json().catch(() => null)) as
      | {
          user?: { id?: string; email?: string | null; user_metadata?: { full_name?: string | null } | null };
        }
      | null;

    if (!response.ok) {
      return NextResponse.redirect(fallbackUrl);
    }

    if (payload?.user?.id) {
      await writeAppSession({
        uid: payload.user.id,
        email: payload.user.email ?? null,
        fullName: payload.user.user_metadata?.full_name ?? null,
        recoveryVerifiedAt: type === 'recovery' ? Date.now() : null
      });
    }

    return NextResponse.redirect(new URL(redirectPath, getPublicSiteUrl()));
  } catch {
    return NextResponse.redirect(fallbackUrl);
  }
}
