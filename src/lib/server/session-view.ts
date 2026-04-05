import { toInitials } from '@/lib/auth';
import type { SessionView } from '@/lib/session-view';
import { readAppSession } from '@/lib/server/app-session';
import { getUserContextById } from '@/lib/server/supabase-admin';

export async function readSessionViewServer(): Promise<SessionView> {
  const session = await readAppSession();
  if (!session) {
    return { authenticated: false, reason: 'no_session' };
  }

  try {
    const ctx = await getUserContextById(session.uid, { email: session.email, fullName: session.fullName });
    return {
      authenticated: true,
      userId: ctx.userId,
      actorKind: ctx.actorKind,
      fullName: ctx.fullName,
      email: ctx.email,
      initials: toInitials(ctx.fullName, ctx.email),
      availableAdultProfiles: ctx.availableAdultProfiles,
      activeProfile: ctx.activeProfile,
      hasAnyAdultProfile: ctx.hasAnyAdultProfile,
      hasPin: ctx.hasPin,
      contextResolved: true
    };
  } catch (error) {
    console.error('[session-view] failed to resolve user context', { userId: session.uid, error });
    return {
      authenticated: true,
      contextResolved: false,
      reason: 'context_unavailable',
      userId: session.uid,
      email: session.email,
      fullName: session.fullName,
      initials: toInitials(session.fullName, session.email)
    };
  }
}
