import { redirect } from 'next/navigation';
import { SecuritySettingsForm } from './security-settings-form';
import { ROUTES } from '@/lib/auth';
import { readSessionViewServer } from '@/lib/server/session-view';
import { shouldRedirectSecuritySettingsToLogin } from '@/components/navigation-contract';

export default async function SecuritySettingsPage() {
  const session = await readSessionViewServer();

  if (shouldRedirectSecuritySettingsToLogin(session)) {
    redirect(ROUTES.login);
  }

  return <SecuritySettingsForm initialHasPin={session.hasPin} />;
}
