"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import { SessionNavActions } from "@/components/session-nav-actions";
import { useSessionView } from "@/components/use-session-view";
import {
  canRenderSessionNavActions,
  resolveTopNavAction,
} from "@/lib/navigation-contract";
import { PRIMARY_NAV_CONFIG } from "@/lib/navigation/primary-nav";
import { NavPillLink, NavigationHeaderShell } from "@/components/navigation/primitives";

export function TopNav() {
  const pathname = usePathname();
  const { state, sessionResolved } = useSessionView();

  const showTeacherPrimaryNav = state.kind === "adult" && state.activeProfile === "teacher";

  const navAction = (() => {
    const action = resolveTopNavAction(pathname, state, sessionResolved);

    switch (action) {
      case "session-actions":
        if (!canRenderSessionNavActions(state)) {
          return null;
        }

        return <SessionNavActions state={state} />;
      case "guest-join":
        return (
          <Link
            href={ROUTES.join}
            className="landing-btn landing-btn-primary min-h-11 px-5"
          >
            Создать аккаунт
          </Link>
        );
      case "guest-login":
        return (
          <Link
            href={ROUTES.login}
            className="landing-btn landing-btn-primary min-h-11 px-5"
          >
            Войти
          </Link>
        );
      case "skeleton":
        return (
          <div
            className="landing-btn landing-btn-muted min-h-11 min-w-[148px] px-5"
            aria-hidden="true"
          >
            <span className="block h-4 w-24 animate-pulse rounded-full bg-neutral-300/70" />
          </div>
        );
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  })();

  return (
    <header className="container relative z-50 pt-4 md:pt-6">
      <NavigationHeaderShell className="relative z-50 flex flex-wrap items-center gap-3 md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:px-5">
        <Link href={ROUTES.home} className="text-xl font-black tracking-tight">
          Shidao™
        </Link>

        {showTeacherPrimaryNav ? (
          <nav
            aria-label={PRIMARY_NAV_CONFIG.teacher.ariaLabel}
            className="order-3 w-full overflow-x-auto overflow-y-visible py-1 md:order-none md:w-auto md:justify-self-center"
          >
            <ul className="mx-auto flex min-w-max items-center gap-1">
              {PRIMARY_NAV_CONFIG.teacher.items.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <li key={item.id}>
                    <NavPillLink
                      href={item.href}
                      active={active}
                      ariaCurrent={active ? "page" : undefined}
                      className="min-h-9 px-3.5 text-sm font-medium"
                    >
                      {item.label}
                    </NavPillLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        <div className="ml-auto md:ml-0 md:justify-self-end">{navAction}</div>
      </NavigationHeaderShell>
    </header>
  );
}
