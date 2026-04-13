"use client";

import Link from "next/link";
import { type MouseEvent, type ReactNode } from "react";
import {
  NavPillLink,
  NavigationHeaderShell,
} from "@/components/navigation/primitives";
import { classNames } from "@/lib/ui/classnames";

export type SiteHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  active: boolean;
  scroll?: boolean;
};

type SiteHeaderProps = {
  variant: "marketing-hero" | "product";
  brandHref: string;
  brandLabel?: string;
  navAriaLabel?: string;
  navItems?: SiteHeaderNavItem[];
  actions?: ReactNode;
  className?: string;
  shellClassName?: string;
  smoothAnchorScroll?: boolean;
  anchorOffset?: number;
};

export function SiteHeader({
  variant,
  brandHref,
  brandLabel = "Shidao™",
  navAriaLabel,
  navItems = [],
  actions,
  className,
  shellClassName,
  smoothAnchorScroll = false,
  anchorOffset = 96,
}: SiteHeaderProps) {
  const hasNav = navItems.length > 0;
  const hasTrademarkMark = brandLabel.endsWith("™");
  const brandText = hasTrademarkMark ? brandLabel.slice(0, -1) : brandLabel;

  const handleNavClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!smoothAnchorScroll || !href.startsWith("#")) {
      return;
    }

    const targetId = href.slice(1);
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const targetTop =
      target.getBoundingClientRect().top + window.scrollY - anchorOffset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new Event("hashchange"));
  };

  return (
    <header className={classNames("site-header", className)}>
      <NavigationHeaderShell
        className={classNames(
          "site-header-shell",
          variant === "marketing-hero" && "site-header-shell-marketing",
          shellClassName,
        )}
      >
        <Link
          href={brandHref}
          className="site-header-brand text-xl font-black tracking-tight"
        >
          {brandText}
          {hasTrademarkMark ? (
            <span className="site-header-brand-mark">™</span>
          ) : null}
        </Link>

        {hasNav ? (
          <div className="site-header-nav-scroll md:justify-self-center">
            <nav aria-label={navAriaLabel}>
              <ul className="site-header-nav-list">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <NavPillLink
                      href={item.href}
                      active={item.active}
                      ariaCurrent={item.active ? "page" : undefined}
                      className="site-header-nav-pill text-sm font-medium"
                      scroll={item.scroll}
                      onClick={(event) => handleNavClick(event, item.href)}
                    >
                      {item.label}
                    </NavPillLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        <div className="site-header-actions">{actions}</div>
      </NavigationHeaderShell>
    </header>
  );
}
