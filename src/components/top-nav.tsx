'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PROFILE_LABELS, ROUTES, type ProfileKind } from '@/lib/auth';
import { signOutViaServer } from '@/lib/auth-flow';

type SessionView = {
  authenticated: boolean;
  fullName?: string | null;
  email?: string | null;
  initials?: string;
  actorKind?: 'adult' | 'student';
  availableAdultProfiles?: ProfileKind[];
  activeProfile?: ProfileKind | null;
};

const navLinkStyle = 'rounded-full px-4 py-2 text-sm font-medium transition hover:bg-black/5';

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SessionView>({ authenticated: false });

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload: SessionView) => setState(payload))
      .catch(() => setState({ authenticated: false }));
  }, [pathname]);

  const canSwitch = useMemo(
    () => state.actorKind === 'adult' && (state.availableAdultProfiles?.length ?? 0) > 1,
    [state.actorKind, state.availableAdultProfiles]
  );

  async function handleSwitch(profile: ProfileKind) {
    await fetch('/api/preferences/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile })
    });
    setOpen(false);
    router.push(ROUTES.dashboard);
    router.refresh();
  }

  async function handleSignOut() {
    await signOutViaServer();
    setOpen(false);
    router.push(ROUTES.login);
    router.refresh();
  }

  return (
    <header className="container pt-6">
      <div className="glass relative flex items-center justify-between gap-3 rounded-3xl px-5 py-4 shadow-sm">
        <Link href={ROUTES.home} className="text-xl font-black tracking-tight">
          Shidao
        </Link>
        <nav className="hidden gap-2 md:flex">
          <Link href={ROUTES.home} className={navLinkStyle}>Главная</Link>
          {!state.authenticated && <Link href={ROUTES.login} className={navLinkStyle}>Вход</Link>}
          {!state.authenticated && <Link href={ROUTES.join} className={navLinkStyle}>Регистрация</Link>}
        </nav>

        {!state.authenticated ? (
          <Link href={ROUTES.login} className="rounded-full bg-black px-4 py-2 font-semibold text-white">Войти</Link>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="inline-flex items-center gap-3 rounded-full bg-white px-3 py-2"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                {state.initials ?? 'U'}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-sm font-semibold">{state.fullName ?? 'Пользователь'}</span>
                <span className="block text-xs text-neutral-500">{state.email ?? 'Без email'}</span>
              </span>
            </button>

            {open && (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">{state.fullName ?? 'Пользователь'}</p>
                  <p className="text-xs text-neutral-500">{state.email ?? 'Без email'}</p>
                </div>

                {canSwitch && (
                  <div className="border-t border-black/5 py-1">
                    {(state.availableAdultProfiles ?? []).map((profile) => (
                      <button
                        key={profile}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                        onClick={() => handleSwitch(profile)}
                        type="button"
                      >
                        <span>{PROFILE_LABELS[profile]}</span>
                        {state.activeProfile === profile && <span className="text-xs text-neutral-500">Активно</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-black/5 py-1">
                  <Link href={ROUTES.settingsSecurity} className="block rounded-xl px-3 py-2 text-sm hover:bg-black/5" onClick={() => setOpen(false)}>
                    Настройки безопасности
                  </Link>
                  <button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5" onClick={handleSignOut} type="button">
                    Выйти
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
