import { NextRequest, NextResponse } from 'next/server';
import { readAppSession } from '@/lib/server/app-session';
import { hasUserPin, setUserPin, trySignInWithPassword, verifyUserPin } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

type Payload = { newPin?: string; currentSecret?: string };

function validPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export async function POST(req: NextRequest) {
  const session = await readAppSession();
  if (!session) return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 });

  const body = (await req.json()) as Payload;
  const newPin = (body.newPin ?? '').trim();
  const currentSecret = (body.currentSecret ?? '').trim();

  if (!validPin(newPin)) {
    return NextResponse.json({ error: 'PIN должен состоять из 4-8 цифр.' }, { status: 400 });
  }

  const alreadyConfigured = await hasUserPin(session.uid);
  if (alreadyConfigured) {
    if (!currentSecret) {
      return NextResponse.json({ error: 'Нужно подтвердить текущим паролем или PIN.' }, { status: 400 });
    }

    const passwordAuth = session.email ? await trySignInWithPassword(session.email, currentSecret) : null;
    const pinAuth = await verifyUserPin(session.uid, currentSecret);

    if (!passwordAuth && !pinAuth) {
      return NextResponse.json({ error: 'Подтверждение не прошло.' }, { status: 401 });
    }
  }

  await setUserPin(session.uid, newPin);
  return NextResponse.json({ ok: true });
}
