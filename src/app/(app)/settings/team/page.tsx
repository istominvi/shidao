import { redirect } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { SettingsNavigation } from '@/components/settings-navigation';
import { ROUTES } from '@/lib/auth';
import { requireUserContext } from '@/lib/server/user-context';
import { InviteTeamForm } from './invite-team-form';

export default async function TeamSettingsPage() {
  const context = await requireUserContext();

  if (context.actorKind !== 'adult') {
    redirect(ROUTES.dashboard);
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 grid gap-4 pb-12 md:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsNavigation />

        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-sky-100 text-sky-700">Администрирование</p>
          <h1 className="mt-4 text-3xl font-black">Команда и приглашения</h1>
          <p className="mt-2 text-sm text-neutral-600">Отправка приглашения через серверный admin-flow Supabase.</p>

          <InviteTeamForm />
        </div>
      </section>
    </main>
  );
}
