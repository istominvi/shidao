"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { NavPillLink, NavigationHeaderShell } from "@/components/navigation/primitives";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SiteHeaderVariant = "marketing-hero" | "product";

export type SiteHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  ariaCurrent?: "page" | "true";
  scroll?: boolean;
};

type SiteHeaderProps = {
  variant: SiteHeaderVariant;
  ariaLabel: string;
  navItems: SiteHeaderNavItem[];
  actions?: ReactNode;
  className?: string;
  brand?: ReactNode;
  navClassName?: string;
};

const defaultBrand = (
  <Link href="/" className="nav-brand-link">
    Shidao™
  </Link>
);

export function SiteHeader({
  variant,
  ariaLabel,
  navItems,
  actions,
  className,
  brand = defaultBrand,
  navClassName,
}: SiteHeaderProps) {
  return (
    <NavigationHeaderShell
      variant={variant}
      className={cx("site-header-grid", className)}
    >
      <div className="site-header-brand">{brand}</div>

      <nav
        aria-label={ariaLabel}
        className={cx("site-header-nav-wrap", navClassName)}
      >
        <ul className="site-header-nav-list">
          {navItems.map((item) => (
            <li key={item.id}>
              <NavPillLink
                href={item.href}
                active={item.active}
                ariaCurrent={item.ariaCurrent}
                className="site-header-pill"
                scroll={item.scroll}
              >
                {item.label}
              </NavPillLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="site-header-actions">{actions}</div>
    </NavigationHeaderShell>
  );
}
