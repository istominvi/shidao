'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { SessionNavActions } from '@/components/session-nav-actions';
import { useSessionView } from '@/components/use-session-view';

export function TopNav() {
  const pathname = usePathname();
  const { state, sessionResolved } = useSessionView();

  const isLoginPage = pathname === ROUTES.login;
  const isProtectedRoute =
    pathname === ROUTES.dashboard ||
    pathname.startsWith(`${ROUTES.dashboard}/`) ||
    pathname === ROUTES.onboarding ||
    pathname.startsWith(`${ROUTES.onboarding}/`) ||
    pathname === ROUTES.settingsProfile ||
    pathname.startsWith('/settings/');

  return (
    <header className="container relative z-50 pt-4 md:pt-6">
      <div className="glass landing-surface relative z-50 flex items-center justify-between gap-3 rounded-[1.6rem] border border-white/70 px-4 py-3 md:px-5">
        <Link href={ROUTES.home} className="text-xl font-black tracking-tight">
          Shidao
        </Link>

        {state.authenticated ? (
          <SessionNavActions state={state} />
        ) : sessionResolved && !isProtectedRoute ? (
          isLoginPage ? (
            <Link href={ROUTES.join} className="landing-btn landing-btn-primary min-h-11 px-5">
              Создать аккаунт
            </Link>
          ) : (
            <Link href={ROUTES.login} className="landing-btn landing-btn-primary min-h-11 px-5">
              Войти
            </Link>
          )
        ) : (
          <div className="landing-btn landing-btn-muted min-h-11 min-w-[148px] px-5" aria-hidden="true">
            <span className="block h-4 w-24 animate-pulse rounded-full bg-neutral-300/70" />
          </div>
        )}
      </div>
    </header>
  );
}
