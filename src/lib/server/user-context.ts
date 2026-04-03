import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { readAppSession } from '@/lib/server/app-session';
import { ensureUserPreference, getUserContextById, setLastActiveProfile } from '@/lib/server/supabase-admin';

export async function requireUserContext() {
  const session = await readAppSession();
  if (!session) {
    redirect(ROUTES.login);
  }

  const context = await getUserContextById(session.uid);
  if (context.actorKind === 'adult') {
    await ensureUserPreference(context.userId);
    if (context.availableAdultProfiles.length === 2 && !context.preferences?.last_active_profile) {
      await setLastActiveProfile(context.userId, 'parent');
      context.activeProfile = 'parent';
    }
  }

  return context;
}
