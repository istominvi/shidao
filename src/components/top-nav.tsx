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
import { PRIMARY_NAV_CONFIG, type PrimaryNavConfig } from "@/lib/navigation/primary-nav";
import { SiteHeader, type SiteHeaderNavItem } from "@/components/site-header";

function resolvePrimaryNavId(state: ReturnType<typeof useSessionView>["state"]): PrimaryNavConfig["id"] | null {
  if (state.kind === "student") return "student";
  if (state.kind === "adult" && state.activeProfile === "teacher") return "teacher";
  if (state.kind === "adult" && state.activeProfile === "parent") return "parent";
  return null;
}

export function TopNav() {
  const pathname = usePathname();
  const { state, sessionResolved } = useSessionView();
  const isAuthEntryRoute =
    pathname === ROUTES.login || pathname === ROUTES.join;

  const primaryNavId = resolvePrimaryNavId(state);
  const primaryNavConfig = primaryNavId ? PRIMARY_NAV_CONFIG[primaryNavId] : null;

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
            className="nav-pill nav-pill-accent header-action-btn px-5"
          >
            Создать аккаунт
          </Link>
        );
      case "guest-login":
        return (
          <Link
            href={ROUTES.login}
            className="nav-pill nav-pill-inactive header-action-btn px-5"
          >
            Войти
          </Link>
        );
      case "skeleton":
        return (
          <div
            className="nav-pill nav-pill-inactive header-action-btn min-w-[148px] px-5"
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

  const navItems: SiteHeaderNavItem[] = primaryNavConfig
    ? primaryNavConfig.items.map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
        active: item.isActive(pathname),
        scroll: false,
      }))
    : [];

  return (
    <div className="container relative z-50 pt-4 md:pt-5">
      <SiteHeader
        variant="product"
        brandHref={ROUTES.home}
        navAriaLabel={primaryNavConfig?.ariaLabel}
        navItems={navItems}
        actions={navAction}
        shellClassName={isAuthEntryRoute ? "site-header-shell-transparent" : undefined}
      />
    </div>
  );
}
