import { SecuritySettingsForm } from './security-settings-form';
import { requireUserContext } from '@/lib/server/user-context';

export default async function SecuritySettingsPage() {
  const context = await requireUserContext();

  return <SecuritySettingsForm initialHasPin={context.hasPin} />;
}
