import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { readAppSession } from '@/lib/server/app-session';
import { ensureUserPreference, getUserContextById, setLastActiveProfile } from '@/lib/server/supabase-admin';

export async function requireUserContext() {
  const session = await readAppSession();
  if (!session) {
    redirect(ROUTES.login);
  }

  const context = await getUserContextById(session.uid, { email: session.email, fullName: session.fullName });
  if (context.actorKind === 'adult') {
    try {
      await ensureUserPreference(context.userId);
    } catch (error) {
      console.error('[user-context] ensureUserPreference failed', { userId: context.userId, error });
    }

    if (context.availableAdultProfiles.length === 2 && !context.preferences?.last_active_profile) {
      try {
        await setLastActiveProfile(context.userId, 'parent');
        context.activeProfile = 'parent';
      } catch (error) {
        console.error('[user-context] setLastActiveProfile failed', { userId: context.userId, error });
      }
    }
  }

  return context;
}
