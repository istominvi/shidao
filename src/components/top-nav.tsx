'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { findParentByAuthUserId, findStudentByAuthUserId, findTeacherByAuthUserId, getSession, signOut } from '@/lib/supabase-client';
import { toProfileLabel, type ProfileKind } from '@/lib/auth';

type HeaderState = {
  isReady: boolean;
  isAuthenticated: boolean;
  activeProfile: ProfileKind | 'student' | 'multi' | null;
};

const navLinkStyle = 'rounded-full px-4 py-2 text-sm font-medium transition hover:bg-black/5';

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<HeaderState>({
    isReady: false,
    isAuthenticated: false,
    activeProfile: null
  });

  useEffect(() => {
    async function load() {
      const session = getSession();

      if (!session) {
        setState({ isReady: true, isAuthenticated: false, activeProfile: null });
        return;
      }

      const student = await findStudentByAuthUserId(session.user.id, session.access_token);
      if (student?.id) {
        setState({ isReady: true, isAuthenticated: true, activeProfile: 'student' });
        return;
      }

      const [teacher, parent] = await Promise.all([
        findTeacherByAuthUserId(session.user.id, session.access_token),
        findParentByAuthUserId(session.user.id, session.access_token)
      ]);

      const activeProfile = teacher?.id && parent?.id
        ? (pathname.includes('/dashboard/parent') ? 'parent' : pathname.includes('/dashboard/teacher') ? 'teacher' : 'multi')
        : teacher?.id
          ? 'teacher'
          : parent?.id
            ? 'parent'
            : null;

      setState({ isReady: true, isAuthenticated: true, activeProfile });
    }

    load();
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="container pt-6">
      <div className="glass flex items-center justify-between gap-3 rounded-3xl px-5 py-4 shadow-sm">
        <Link href="/" className="text-xl font-black tracking-tight">
          Shidao
        </Link>
        <nav className="hidden gap-2 md:flex">
          <Link href="/" className={navLinkStyle}>Главная</Link>
          <Link href="/login" className={navLinkStyle}>Вход</Link>
          <Link href="/join" className={navLinkStyle}>Регистрация</Link>
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {state.isReady && state.activeProfile && state.activeProfile !== 'multi' && (
            <span className="chip bg-neutral-100">
              {state.activeProfile === 'student' ? 'Ученик' : toProfileLabel(state.activeProfile)}
            </span>
          )}
          {state.isReady && state.activeProfile === 'multi' && (
            <Link href="/dashboard/select-profile" className="rounded-full bg-white px-4 py-2 font-medium">
              Выбрать профиль
            </Link>
          )}
          {state.isReady && state.isAuthenticated ? (
            <button type="button" className="rounded-full bg-black px-4 py-2 font-semibold text-white" onClick={handleSignOut}>
              Выйти
            </button>
          ) : (
            <Link href="/login" className="rounded-full bg-black px-4 py-2 font-semibold text-white">Войти</Link>
          )}
        </div>
      </div>
    </header>
  );
}
