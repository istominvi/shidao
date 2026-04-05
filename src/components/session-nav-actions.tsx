'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROFILE_LABELS, ROUTES, type ProfileKind } from '@/lib/auth';
import { signOutViaServer } from '@/lib/auth-flow';
import type { SessionView } from '@/components/use-session-view';

type SessionNavActionsProps = {
  state: SessionView;
  variant?: 'top-nav' | 'landing';
};

export function SessionNavActions({ state, variant = 'top-nav' }: SessionNavActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const canSwitch = useMemo(
    () => state.actorKind === 'adult' && (state.availableAdultProfiles?.length ?? 0) > 1,
    [state.actorKind, state.availableAdultProfiles]
  );
  const missingProfile = useMemo<ProfileKind | null>(() => {
    if (state.actorKind !== 'adult') return null;

    const available = state.availableAdultProfiles ?? [];
    if (available.includes('parent') && !available.includes('teacher')) return 'teacher';
    if (available.includes('teacher') && !available.includes('parent')) return 'parent';

    return null;
  }, [state.actorKind, state.availableAdultProfiles]);
  const switchTargets = useMemo(
    () => (state.availableAdultProfiles ?? []).filter((profile) => profile !== state.activeProfile),
    [state.availableAdultProfiles, state.activeProfile]
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`landing-btn landing-btn-muted inline-flex min-h-11 items-center gap-3 rounded-full border-black/10 bg-white/90 px-2 py-1.5 ${variant === 'landing' ? 'w-full justify-center sm:w-auto' : ''}`}
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
          {state.initials ?? 'U'}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-sm font-semibold leading-tight">{state.fullName ?? 'Пользователь'}</span>
          <span className="block text-xs text-neutral-500">{state.email ?? 'Без email'}</span>
        </span>
      </button>

      {open && (
        <div className="landing-surface absolute right-0 z-[120] mt-2 w-72 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">{state.fullName ?? 'Пользователь'}</p>
            <p className="text-xs text-neutral-500">{state.email ?? 'Без email'}</p>
          </div>

          {canSwitch && (
            <div className="border-t border-black/5 py-1">
              {switchTargets.map((profile) => (
                <button
                  key={profile}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                  onClick={() => handleSwitch(profile)}
                  type="button"
                >
                  <span>Перейти в {PROFILE_LABELS[profile].toLowerCase()}</span>
                  <span className="text-xs text-neutral-500">Сменить</span>
                </button>
              ))}
            </div>
          )}

          {!canSwitch && missingProfile && (
            <div className="border-t border-black/5 py-1">
              <Link
                href={`${ROUTES.onboarding}?mode=add-profile`}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-black/5"
                onClick={() => setOpen(false)}
              >
                <span>Добавить {PROFILE_LABELS[missingProfile].toLowerCase()}</span>
                <span className="text-xs text-neutral-500">Открыть</span>
              </Link>
            </div>
          )}

          <div className="border-t border-black/5 py-1">
            <Link
              href={ROUTES.settingsProfile}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              Профиль и email
            </Link>
            <Link
              href={ROUTES.settingsSecurity}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              Настройки безопасности
            </Link>
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5" onClick={handleSignOut} type="button">
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
