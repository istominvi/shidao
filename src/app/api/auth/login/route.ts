import { NextRequest, NextResponse } from 'next/server';
import { AUTH_MESSAGES, normalizeIdentifier, isEmail } from '@/lib/auth';
import { writeAppSession } from '@/lib/server/app-session';
import {
  ensureUserPreference,
  findStudentAuthEmail,
  getUserContextById,
  resolvePostLoginRedirect,
  trySignInWithPassword,
  verifyUserPin
} from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

type Payload = { identifier?: string; secret?: string };

function fail(status = 401, message: string = AUTH_MESSAGES.invalidCredentials) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let stage = 'read-body';

  try {
    const body = (await req.json()) as Payload;
    stage = 'normalize-credentials';

    const identifier = normalizeIdentifier(body.identifier ?? '');
    const secret = (body.secret ?? '').trim();

    if (!identifier || !secret) {
      return fail();
    }

    let resolvedEmail = '';
    let candidateUserId: string | null = null;

    stage = 'resolve-identifier';
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

    stage = 'password-login';
    const passwordSession = await trySignInWithPassword(resolvedEmail, secret);

    if (passwordSession?.user?.id) {
      const userId = passwordSession.user.id;
      stage = 'write-session-password';
      await writeAppSession({
        uid: userId,
        email: passwordSession.user.email ?? null,
        fullName: passwordSession.user.user_metadata?.full_name ?? null
      });

      stage = 'ensure-user-preference-password';
      try {
        await ensureUserPreference(userId);
      } catch (error) {
        console.error('[auth-login] ensureUserPreference failed after successful password auth', { userId, error });
      }

      stage = 'resolve-post-login-route-password';
      const redirectTo = await resolvePostLoginRedirect(userId);
      return NextResponse.json({ redirectTo });
    }

    if (candidateUserId) {
      stage = 'student-pin-verify';
      const pinOk = await verifyUserPin(candidateUserId, secret);
      if (pinOk) {
        stage = 'load-student-context';
        const context = await getUserContextById(candidateUserId, { email: resolvedEmail });

        stage = 'write-session-pin';
        await writeAppSession({ uid: candidateUserId, email: context.email, fullName: context.fullName });

        stage = 'ensure-user-preference-pin';
        try {
          await ensureUserPreference(candidateUserId);
        } catch (error) {
          console.error('[auth-login] ensureUserPreference failed after successful pin auth', { userId: candidateUserId, error });
        }

        return NextResponse.json({ redirectTo: '/dashboard' });
      }
    }

    return fail();
  } catch (error) {
    console.error('[auth-login] unexpected error', { stage, error });

    if (stage === 'write-session-password' || stage === 'write-session-pin') {
      return fail(500, 'Не удалось сохранить сессию входа. Попробуйте ещё раз.');
    }

    return fail(503, AUTH_MESSAGES.temporarilyUnavailable);
  }
}
