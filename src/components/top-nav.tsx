"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import { SessionNavActions } from "@/components/session-nav-actions";
import { useSessionView } from "@/components/use-session-view";
import { isRouteWithin } from "@/lib/routes";
import {
  canRenderSessionNavActions,
  resolveTopNavAction,
} from "@/lib/navigation-contract";

type TeacherNavItem = {
  label: string;
  href: string;
  isActive: (pathname: string | null) => boolean;
};

const TEACHER_NAV_ITEMS: TeacherNavItem[] = [
  {
    label: "Обзор",
    href: ROUTES.dashboard,
    isActive: (pathname) => pathname === ROUTES.dashboard,
  },
  {
    label: "Группы",
    href: ROUTES.groups,
    isActive: (pathname) => isRouteWithin(pathname, ROUTES.groups),
  },
  {
    label: "Расписание",
    href: ROUTES.lessons,
    isActive: (pathname) => isRouteWithin(pathname, ROUTES.lessons),
  },
  {
    label: "Методики",
    href: ROUTES.methodologies,
    isActive: (pathname) => isRouteWithin(pathname, ROUTES.methodologies),
  },
];

export function TopNav() {
  const pathname = usePathname();
  const { state, sessionResolved } = useSessionView();

  const showTeacherPrimaryNav =
    state.kind === "adult" && state.activeProfile === "teacher";

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
      <div className="glass landing-surface relative z-50 flex flex-wrap items-center gap-3 rounded-[1.6rem] border border-white/70 px-4 py-3 md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:px-5">
        <Link href={ROUTES.home} className="text-xl font-black tracking-tight">
          Shidao™
        </Link>

        {showTeacherPrimaryNav ? (
          <nav
            aria-label="Основная навигация кабинета преподавателя"
            className="order-3 w-full overflow-x-auto md:order-none md:w-auto md:justify-self-center"
          >
            <ul className="mx-auto flex min-w-max items-center gap-1">
              {TEACHER_NAV_ITEMS.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`landing-nav-link inline-flex min-h-9 items-center px-3.5 text-sm font-medium ${
                        active
                          ? "border-black/70 bg-neutral-950 text-white"
                          : "text-neutral-700"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        <div className="ml-auto md:ml-0 md:justify-self-end">{navAction}</div>
      </div>
    </header>
  );
}
