import Link from "next/link";
import type { ReactNode } from "react";
import {
  NavPillLink,
  NavigationHeaderShell,
} from "@/components/navigation/primitives";

type AppHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  scroll?: boolean;
};

type AppHeaderProps = {
  brandHref: string;
  brandLabel: string;
  navAriaLabel?: string;
  navItems?: AppHeaderNavItem[];
  rightActions?: ReactNode;
  variant?: "integrated" | "app";
  className?: string;
  withinContainer?: boolean;
  shellClassName?: string;
  navClassName?: string;
  navVisibilityClassName?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AppHeader({
  brandHref,
  brandLabel,
  navAriaLabel,
  navItems = [],
  rightActions,
  variant = "app",
  className,
  withinContainer = true,
  shellClassName,
  navClassName,
  navVisibilityClassName,
}: AppHeaderProps) {
  const hasNav = navItems.length > 0;

  return (
    <header
      className={cx(
        withinContainer ? "container" : null,
        "relative z-50",
        variant === "integrated" ? "pt-4 md:pt-8" : "pt-4 md:pt-6",
        className,
      )}
    >
      <NavigationHeaderShell variant={variant} className={cx("app-header-layout", shellClassName)}>
        <Link
          href={brandHref}
          className="text-xl font-black tracking-tight transition hover:opacity-80"
        >
          {brandLabel}
        </Link>

        {hasNav ? (
          <nav
            aria-label={navAriaLabel}
            className={cx(
              "app-header-nav-scroll order-3 w-full md:order-none md:w-auto md:justify-self-center",
              navVisibilityClassName,
              navClassName,
            )}
          >
            <ul className="app-header-nav-list">
              {navItems.map((item) => (
                <li key={item.id}>
                  <NavPillLink
                    href={item.href}
                    active={item.active}
                    ariaCurrent={item.active ? "page" : undefined}
                    className="app-header-nav-pill"
                    scroll={item.scroll}
                  >
                    {item.label}
                  </NavPillLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        <div className="app-header-actions">{rightActions}</div>
      </NavigationHeaderShell>
    </header>
  );
}
