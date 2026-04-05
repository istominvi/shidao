'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { useSessionView } from '@/components/use-session-view';

function linkClassName(isActive: boolean) {
  return `rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-black text-white' : 'text-neutral-700 hover:bg-black/5'}`;
}

export function SettingsNavigation() {
  const pathname = usePathname();
  const { state } = useSessionView();
  const isAdult = state.kind === 'adult';

  return (
    <nav className="glass rounded-2xl p-3" aria-label="Навигация по настройкам">
      <div className="space-y-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Личное</p>
        <Link href={ROUTES.settingsProfile} className={linkClassName(pathname === ROUTES.settingsProfile)}>
          Профиль и email
        </Link>
        <Link href={ROUTES.settingsSecurity} className={linkClassName(pathname === ROUTES.settingsSecurity)}>
          Безопасность
        </Link>
      </div>

      {isAdult && (
        <div className="mt-4 space-y-1 border-t border-black/10 pt-3">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Администрирование</p>
          <Link href={ROUTES.settingsTeam} className={linkClassName(pathname === ROUTES.settingsTeam)}>
            Команда и приглашения
          </Link>
        </div>
      )}
    </nav>
  );
}
