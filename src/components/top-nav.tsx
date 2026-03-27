'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ensureAdultRole,
  findAdultByAuthUserId,
  findAdultRoles,
  findStudentByAuthUserId,
  getSession,
  signOut,
  updateAdultCurrentRole
} from '@/lib/supabase-client';
import { toRoleLabel, toRoleRoute, type AdultRole } from '@/lib/auth';

type HeaderState = {
  isReady: boolean;
  isAuthenticated: boolean;
  userType: 'adult' | 'student' | null;
  adultId: string | null;
  accessToken: string | null;
  currentRole: AdultRole | null;
};

const navLinkStyle = 'rounded-full px-4 py-2 text-sm font-medium transition hover:bg-black/5';

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<HeaderState>({
    isReady: false,
    isAuthenticated: false,
    userType: null,
    adultId: null,
    accessToken: null,
    currentRole: null
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const session = getSession();

      if (!session) {
        setState((s) => ({ ...s, isReady: true }));
        return;
      }

      const adult = await findAdultByAuthUserId(session.user.id, session.access_token);
      if (adult?.id) {
        const roles = await findAdultRoles(adult.id, session.access_token);
        const currentRole = (adult.current_role as AdultRole | null) ?? ((roles[0]?.role as AdultRole | undefined) ?? null);
        setState({
          isReady: true,
          isAuthenticated: true,
          userType: 'adult',
          adultId: adult.id,
          accessToken: session.access_token,
          currentRole
        });
        return;
      }

      const student = await findStudentByAuthUserId(session.user.id, session.access_token);
      if (student?.id) {
        setState({
          isReady: true,
          isAuthenticated: true,
          userType: 'student',
          adultId: null,
          accessToken: session.access_token,
          currentRole: null
        });
        return;
      }

      setState((s) => ({ ...s, isReady: true }));
    }

    load();
  }, [pathname]);

  const nextRole = useMemo(() => {
    if (state.userType !== 'adult' || !state.currentRole) return null;
    return state.currentRole === 'parent' ? 'teacher' : 'parent';
  }, [state.currentRole, state.userType]);

  async function switchRole() {
    if (!state.adultId || !state.accessToken || !nextRole || busy) return;
    setBusy(true);

    try {
      await ensureAdultRole(state.adultId, nextRole, state.accessToken);
      await updateAdultCurrentRole(state.adultId, nextRole, state.accessToken);
      router.push(toRoleRoute(nextRole));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/auth/sign-in');
    router.refresh();
  }

  return (
    <header className="container pt-6">
      <div className="glass flex items-center justify-between gap-3 rounded-3xl px-5 py-4 shadow-sm">
        <Link href="/" className="text-xl font-black tracking-tight">
          ShiDao.ru
        </Link>
        <nav className="hidden gap-2 md:flex">
          <Link href="/" className={navLinkStyle}>
            Главная
          </Link>
          <Link href="/auth/sign-in" className={navLinkStyle}>
            Вход
          </Link>
          <Link href="/auth/sign-up" className={navLinkStyle}>
            Регистрация
          </Link>
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {state.isReady && state.userType === 'adult' && state.currentRole && (
            <span className="chip bg-neutral-100">{toRoleLabel(state.currentRole)}</span>
          )}
          {state.isReady && state.userType === 'adult' && state.currentRole && nextRole && (
            <button
              type="button"
              onClick={switchRole}
              disabled={busy}
              className="rounded-full bg-white px-4 py-2 font-medium disabled:opacity-60"
            >
              {busy ? 'Переключаем…' : `Перейти в роль «${toRoleLabel(nextRole)}»`}
            </button>
          )}
          {state.isReady && state.isAuthenticated ? (
            <button type="button" className="rounded-full bg-black px-4 py-2 font-semibold text-white" onClick={handleSignOut}>
              Выйти
            </button>
          ) : (
            <Link href="/auth/sign-in" className="rounded-full bg-black px-4 py-2 font-semibold text-white">
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
