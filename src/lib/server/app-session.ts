import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const APP_SESSION_COOKIE = 'shidao_session';

type SessionPayload = {
  uid: string;
  email: string | null;
  fullName: string | null;
  recoveryVerifiedAt?: number | null;
  iat: number;
};

function getSecret() {
  return process.env.APP_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-secret-change-me';
}

function sign(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}

export async function readAppSession() {
  const jar = await cookies();
  const raw = jar.get(APP_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verify(raw);
}

export async function writeAppSession(input: { uid: string; email?: string | null; fullName?: string | null; recoveryVerifiedAt?: number | null }) {
  const jar = await cookies();
  const token = sign({
    uid: input.uid,
    email: input.email ?? null,
    fullName: input.fullName ?? null,
    recoveryVerifiedAt: input.recoveryVerifiedAt ?? null,
    iat: Date.now()
  });
  jar.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearAppSession() {
  const jar = await cookies();
  jar.delete(APP_SESSION_COOKIE);
}
