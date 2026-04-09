"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { NavPillLink, NavigationHeaderShell } from "@/components/navigation/primitives";

type SiteHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  ariaCurrent?: "page";
  scroll?: boolean;
};

type SiteHeaderProps = {
  variant: "marketing-hero" | "product";
  brandLabel?: string;
  brandHref: string;
  navAriaLabel?: string;
  navItems?: SiteHeaderNavItem[];
  actions?: ReactNode;
  actionsFullWidthOnMobile?: boolean;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SiteHeader({
  variant,
  brandLabel = "Shidao™",
  brandHref,
  navAriaLabel,
  navItems = [],
  actions,
  actionsFullWidthOnMobile = false,
  className,
}: SiteHeaderProps) {
  const hasNav = navItems.length > 0;

  return (
    <header
      className={cx(
        "site-header",
        variant === "marketing-hero" ? "site-header-marketing" : "site-header-product",
        className,
      )}
    >
      <NavigationHeaderShell className="site-header-shell-grid">
        <Link href={brandHref} className="site-header-brand">
          {brandLabel}
        </Link>

        {hasNav ? (
          <nav
            aria-label={navAriaLabel}
            className="site-header-nav md:justify-self-center"
          >
            <div className="site-header-nav-scroll">
              <ul className="site-header-nav-list">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <NavPillLink
                      href={item.href}
                      active={item.active}
                      ariaCurrent={item.ariaCurrent}
                      scroll={item.scroll}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </NavPillLink>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        <div
          className={cx(
            "site-header-actions",
            actionsFullWidthOnMobile && "w-full sm:w-auto",
          )}
        >
          {actions}
        </div>
      </NavigationHeaderShell>
    </header>
  );
}
