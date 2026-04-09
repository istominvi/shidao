"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavPillLink, NavigationHeaderShell } from "@/components/navigation/primitives";
import { ROUTES } from "@/lib/auth";
import type { PrimaryNavItem } from "@/lib/navigation/primary-nav";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type PathnameActiveStrategy = {
  type: "pathname";
  pathname: string | null;
};

type SectionActiveStrategy = {
  type: "section";
};

type ActiveStrategy = PathnameActiveStrategy | SectionActiveStrategy;

type SiteHeaderProps = {
  variant: "marketing-hero" | "product";
  nav: {
    ariaLabel: string;
    items: PrimaryNavItem[];
  };
  activeStrategy: ActiveStrategy;
  actions?: ReactNode;
  actionsClassName?: string;
  className?: string;
  brand?: ReactNode;
};

function useSectionActiveItemId(items: PrimaryNavItem[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sectionItems = useMemo(
    () =>
      items
        .map((item) => {
          if (!item.href.startsWith("#")) return null;
          const sectionId = item.href.slice(1);
          return sectionId ? { itemId: item.id, sectionId } : null;
        })
        .filter((item): item is { itemId: string; sectionId: string } => Boolean(item)),
    [items],
  );

  useEffect(() => {
    if (sectionItems.length === 0 || typeof window === "undefined") {
      return;
    }

    const activateByHash = () => {
      const currentHash = window.location.hash.replace(/^#/, "");
      if (!currentHash) return false;

      const matched = sectionItems.find((item) => item.sectionId === currentHash);
      if (!matched) return false;

      setActiveId(matched.itemId);
      return true;
    };

    if (!activateByHash()) {
      setActiveId(sectionItems[0]?.itemId ?? null);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const matched = sectionItems.find((item) => item.sectionId === visible.target.id);
        if (matched) {
          setActiveId(matched.itemId);
        }
      },
      {
        root: null,
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.4, 0.6],
      },
    );

    sectionItems.forEach(({ sectionId }) => {
      const section = document.getElementById(sectionId);
      if (section) observer.observe(section);
    });

    const onHashChange = () => {
      activateByHash();
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [sectionItems]);

  return activeId;
}

export function SiteHeader({
  variant,
  nav,
  activeStrategy,
  actions,
  actionsClassName,
  className,
  brand,
}: SiteHeaderProps) {
  const sectionActiveId = useSectionActiveItemId(
    activeStrategy.type === "section" ? nav.items : [],
  );

  const activeId =
    activeStrategy.type === "pathname"
      ? nav.items.find((item) => item.isActive(activeStrategy.pathname))?.id ?? null
      : sectionActiveId;

  return (
    <NavigationHeaderShell
      className={cx(
        "site-header",
        variant === "marketing-hero" ? "site-header-marketing" : "site-header-product",
        className,
      )}
    >
      <div className="site-header-layout">
        <div className="site-header-brand">
          {brand ?? (
            <Link href={ROUTES.home} className="site-header-brand-link">
              Shidao™
            </Link>
          )}
        </div>

        {nav.items.length > 0 ? (
          <nav aria-label={nav.ariaLabel} className="site-header-nav-scroll">
            <ul className="site-header-nav-list">
              {nav.items.map((item) => {
                const active = activeId === item.id;

                return (
                  <li key={item.id}>
                    <NavPillLink
                      href={item.href}
                      active={active}
                      ariaCurrent={active ? "page" : undefined}
                      className="site-header-nav-pill"
                      scroll={false}
                    >
                      {item.label}
                    </NavPillLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <div className="site-header-nav-empty" aria-hidden="true" />
        )}

        <div className={cx("site-header-actions", actionsClassName)}>{actions}</div>
      </div>
    </NavigationHeaderShell>
  );
}
