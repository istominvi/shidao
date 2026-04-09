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
import { SiteHeader } from "@/components/site-header";

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

  const teacherNavItems = showTeacherPrimaryNav
    ? PRIMARY_NAV_CONFIG.teacher.items.map((item) => {
        const active = item.isActive(pathname);
        return {
          id: item.id,
          label: item.label,
          href: item.href,
          active,
          ariaCurrent: active ? ("page" as const) : undefined,
          scroll: false,
        };
      })
    : [];

  return (
    <header className="container relative z-50 pt-4 md:pt-6">
      <SiteHeader
        variant="product"
        ariaLabel={PRIMARY_NAV_CONFIG.teacher.ariaLabel}
        navItems={teacherNavItems}
        actions={navAction}
        navClassName={!showTeacherPrimaryNav ? "hidden md:block" : undefined}
      />
    </header>
  );
}
