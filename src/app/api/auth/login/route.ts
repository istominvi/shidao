import { NextRequest, NextResponse } from 'next/server';
import { AUTH_MESSAGES, ROUTES, isEmail, normalizeIdentifier } from '@/lib/auth';
import { writeAppSession } from '@/lib/server/app-session';
import { ensureUserPreference, findStudentAuthEmail, getUserContextById, trySignInWithPassword, verifyUserPin } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

type Payload = { identifier?: string; secret?: string };

function fail(status = 401, message = AUTH_MESSAGES.invalidCredentials) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    const identifier = normalizeIdentifier(body.identifier ?? '');
    const secret = (body.secret ?? '').trim();

    if (!identifier || !secret) {
      return fail();
    }

    let resolvedEmail = '';
    let candidateUserId: string | null = null;

    if (isEmail(identifier)) {
      resolvedEmail = identifier;
    } else {
      const studentMatch = await findStudentAuthEmail(identifier);
      if (!studentMatch) {
        return fail();
      }
      resolvedEmail = studentMatch.email;
      candidateUserId = studentMatch.userId;
    }

    const passwordSession = await trySignInWithPassword(resolvedEmail, secret);

    if (passwordSession?.user?.id) {
      await writeAppSession({
        uid: passwordSession.user.id,
        email: passwordSession.user.email ?? null,
        fullName: passwordSession.user.user_metadata?.full_name ?? null
      });

      await ensureUserPreference(passwordSession.user.id);
      return NextResponse.json({ redirectTo: ROUTES.dashboard });
    }

    if (candidateUserId) {
      const pinOk = await verifyUserPin(candidateUserId, secret);
      if (pinOk) {
        const context = await getUserContextById(candidateUserId);
        await writeAppSession({ uid: candidateUserId, email: context.email, fullName: context.fullName });
        await ensureUserPreference(candidateUserId);
        return NextResponse.json({ redirectTo: ROUTES.dashboard });
      }
    }

    return fail();
  } catch {
    return fail(503, AUTH_MESSAGES.temporarilyUnavailable);
  }
}
