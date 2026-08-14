"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  NavPillLink,
  NavigationHeaderShell,
} from "@/components/navigation/primitives";
import { usePageTransition } from "@/components/navigation/page-transition-provider";
import { classNames } from "@/lib/ui/classnames";

export type SiteHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  active: boolean;
  icon?: LucideIcon;
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
  movingActivePill?: boolean;
};

const EMPTY_ACTIVE_PILL = { left: 0, width: 0, ready: false };
const PRIMARY_NAV_HANDOFF_MS = 180;

type NavNavigateEvent = {
  preventDefault: () => void;
};

export function SiteHeader({
  variant,
  brandHref,
  brandLabel = "Shidao",
  navAriaLabel,
  navItems = [],
  actions,
  className,
  shellClassName,
  smoothAnchorScroll = false,
  anchorOffset = 96,
  movingActivePill = false,
}: SiteHeaderProps) {
  const pageTransition = usePageTransition();
  const hasNav = navItems.length > 0;
  const navTrackRef = useRef<HTMLElement>(null);
  const navItemRefs = useRef(new Map<string, HTMLLIElement>());
  const navigationHandoffTimerRef = useRef<number | null>(null);
  const activeNavItemId = navItems.find((item) => item.active)?.id ?? null;
  const [activePillMotionReady, setActivePillMotionReady] = useState(false);
  const [activePill, setActivePill] = useState(EMPTY_ACTIVE_PILL);

  const cancelNavigationHandoff = useCallback(() => {
    if (navigationHandoffTimerRef.current === null) return;
    window.clearTimeout(navigationHandoffTimerRef.current);
    navigationHandoffTimerRef.current = null;
  }, []);

  const updateActivePillForItem = useCallback(
    (itemId: string | null) => {
      const navTrack = navTrackRef.current;
      const activeItem = itemId ? navItemRefs.current.get(itemId) : null;
      if (!movingActivePill || !navTrack || !activeItem) {
        setActivePill((current) =>
          current.ready ? EMPTY_ACTIVE_PILL : current,
        );
        return;
      }

      const navTrackRect = navTrack.getBoundingClientRect();
      const activeItemRect = activeItem.getBoundingClientRect();
      if (navTrackRect.width <= 0 || activeItemRect.width <= 0) {
        setActivePill((current) =>
          current.ready ? EMPTY_ACTIVE_PILL : current,
        );
        return;
      }

      const nextActivePill = {
        left: activeItemRect.left - navTrackRect.left,
        width: activeItemRect.width,
        ready: true,
      };
      setActivePill((current) => {
        if (
          current.left === nextActivePill.left &&
          current.width === nextActivePill.width &&
          current.ready
        ) {
          return current;
        }
        return nextActivePill;
      });
    },
    [movingActivePill],
  );

  const updateActivePill = useCallback(() => {
    updateActivePillForItem(activeNavItemId);
  }, [activeNavItemId, updateActivePillForItem]);

  useLayoutEffect(() => {
    if (!movingActivePill) return;
    updateActivePill();
    const navTrack = navTrackRef.current;
    if (!navTrack) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateActivePill);
      return () => window.removeEventListener("resize", updateActivePill);
    }

    const observer = new ResizeObserver(updateActivePill);
    observer.observe(navTrack);
    for (const item of navItemRefs.current.values()) observer.observe(item);
    return () => observer.disconnect();
  }, [movingActivePill, navItems, updateActivePill]);

  useEffect(() => {
    if (!activePill.ready) {
      setActivePillMotionReady(false);
      return;
    }

    const frame = window.requestAnimationFrame(() =>
      setActivePillMotionReady(true),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [activePill.ready]);

  useEffect(() => () => cancelNavigationHandoff(), [cancelNavigationHandoff]);

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

  const handleNavNavigate = (
    event: NavNavigateEvent,
    item: SiteHeaderNavItem,
  ) => {
    if (!movingActivePill || !pageTransition) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cancelNavigationHandoff();
      return;
    }

    if (item.active) {
      if (navigationHandoffTimerRef.current !== null) {
        event.preventDefault();
        cancelNavigationHandoff();
        updateActivePillForItem(activeNavItemId);
      }
      return;
    }

    event.preventDefault();
    updateActivePillForItem(item.id);
    cancelNavigationHandoff();
    navigationHandoffTimerRef.current = window.setTimeout(() => {
      navigationHandoffTimerRef.current = null;
      pageTransition.navigate(item.href, { scroll: item.scroll });
    }, PRIMARY_NAV_HANDOFF_MS);
  };

  return (
    <header className={classNames("site-header", className)}>
      <NavigationHeaderShell
        className={classNames(
          "site-header-shell",
          variant === "product" && "site-header-shell-product",
          variant === "marketing-hero" && "site-header-shell-marketing",
          shellClassName,
        )}
      >
        <Link
          href={brandHref}
          className="site-header-brand text-xl font-black tracking-tight"
        >
          {brandLabel}
        </Link>

        {hasNav ? (
          <div
            className={classNames(
              "site-header-nav-scroll md:justify-self-center",
              variant === "product" && "site-header-nav-scroll-product",
            )}
          >
            <nav
              ref={navTrackRef}
              className={movingActivePill ? "site-header-nav-track" : undefined}
              aria-label={navAriaLabel}
              data-active-pill-ready={activePill.ready || undefined}
            >
              {movingActivePill ? (
                <span
                  className="site-header-nav-active-pill"
                  aria-hidden="true"
                  data-ready={activePill.ready || undefined}
                  data-motion-ready={
                    (activePill.ready && activePillMotionReady) || undefined
                  }
                  style={{
                    width: `${activePill.width}px`,
                    transform: `translate3d(${activePill.left}px, 0, 0)`,
                  }}
                />
              ) : null}
              <ul className="site-header-nav-list">
                {navItems.map((item) => (
                  <li
                    key={item.id}
                    ref={(node) => {
                      if (node) navItemRefs.current.set(item.id, node);
                      else navItemRefs.current.delete(item.id);
                    }}
                  >
                    <NavPillLink
                      href={item.href}
                      active={item.active}
                      ariaCurrent={item.active ? "page" : undefined}
                      className="site-header-nav-pill text-sm font-semibold"
                      scroll={item.scroll}
                      onClick={(event) => handleNavClick(event, item.href)}
                      onNavigate={(event) => handleNavNavigate(event, item)}
                    >
                      <span className="nav-pill-content">
                        {item.icon ? (
                          <item.icon
                            size={15}
                            className="nav-pill-icon"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span>{item.label}</span>
                      </span>
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
