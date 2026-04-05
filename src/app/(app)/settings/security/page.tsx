import { redirect } from 'next/navigation';
import { SecuritySettingsForm } from './security-settings-form';
import { ROUTES } from '@/lib/auth';
import { readSessionViewServer } from '@/lib/server/session-view';

export default async function SecuritySettingsPage() {
  const session = await readSessionViewServer();

  if (session.kind === 'guest' || session.kind === 'degraded') {
    redirect(ROUTES.login);
  }

  return <SecuritySettingsForm initialHasPin={session.hasPin} />;
}
