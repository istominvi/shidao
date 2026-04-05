'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROFILE_LABELS, ROUTES, type ProfileKind } from '@/lib/auth';
import { signOutViaServer } from '@/lib/auth-flow';
import { useSessionView } from '@/components/use-session-view';
import type { SessionAdultView, SessionStudentView } from '@/lib/session-view';

type SessionNavActionsProps = {
  state: SessionAdultView | SessionStudentView;
  variant?: 'top-nav' | 'landing';
  portalMenu?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 288;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;

export function SessionNavActions({ state, variant = 'top-nav', portalMenu = false }: SessionNavActionsProps) {
  const router = useRouter();
  const { refetchSession } = useSessionView();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const canSwitch = useMemo(() => state.kind === 'adult' && state.availableProfiles.length > 1, [state]);
  const missingProfile = useMemo<ProfileKind | null>(() => {
    if (state.kind !== 'adult') return null;

    const available = state.availableProfiles;
    if (available.includes('parent') && !available.includes('teacher')) return 'teacher';
    if (available.includes('teacher') && !available.includes('parent')) return 'parent';

    return null;
  }, [state]);
  const switchTargets = useMemo(
    () => (state.kind === 'adult' ? state.availableProfiles.filter((profile) => profile !== state.activeProfile) : []),
    [state]
  );
  const dashboardLabel = useMemo(() => {
    switch (state.kind) {
      case 'student':
        return 'Кабинет ученика';
      case 'adult': {
        const currentProfile = state.activeProfile ?? state.availableProfiles[0] ?? null;
        if (currentProfile) return PROFILE_LABELS[currentProfile];
        return 'Кабинет взрослого';
      }
      default: {
        const _exhaustive: never = state;
        return _exhaustive;
      }
    }
  }, [state]);

  const updateMenuPosition = useCallback(() => {
    if (!portalMenu || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING;
    const left = Math.min(Math.max(rect.right - MENU_WIDTH, VIEWPORT_PADDING), maxLeft);

    setMenuPosition({
      top: rect.bottom + MENU_GAP,
      left
    });
  }, [portalMenu]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !portalMenu) return;

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, portalMenu, updateMenuPosition]);

  async function handleSwitch(profile: ProfileKind) {
    await fetch('/api/preferences/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile })
    });

    await refetchSession();
    setOpen(false);
    router.push(ROUTES.dashboard);
    router.refresh();
  }

  async function handleSignOut() {
    await signOutViaServer();
    await refetchSession();
    setOpen(false);
    router.push(ROUTES.login);
    router.refresh();
  }

  const menu = (
    <div
      ref={menuRef}
      className={`landing-surface w-72 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-xl backdrop-blur-xl ${portalMenu ? 'fixed z-[260]' : 'absolute right-0 z-[120] mt-2'}`}
      style={portalMenu && menuPosition ? { top: menuPosition.top, left: menuPosition.left } : undefined}
    >
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
          href={ROUTES.dashboard}
          className="block rounded-xl px-3 py-2 text-sm hover:bg-black/5"
          onClick={() => setOpen(false)}
        >
          {dashboardLabel}
        </Link>
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
  );

  return (
    <div ref={containerRef} className="relative">
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

      {open && (portalMenu ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
