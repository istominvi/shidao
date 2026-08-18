"use client";

import { usePathname } from "next/navigation";
import { Menu, UserRound, X, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AvatarImage } from "@/components/account/avatar-image";
import { isInternalAuthEmail, ROUTES } from "@/lib/auth";
import type { SessionAccountView } from "@/lib/session-view";
import {
  NavigationDropdownPanel,
  navigationDropdownItemClass,
} from "@/components/navigation/primitives";
import { PageTransitionLink } from "@/components/navigation/page-transition-link";
import { profileTabHref } from "@/lib/navigation/profile-nav";

type SessionNavActionsProps = {
  state: SessionAccountView;
  variant?: "top-nav" | "landing";
  mobileNavItems?: SessionNavItem[];
};

type SessionNavItem = {
  id: string;
  label: string;
  href: string;
  active: boolean;
  icon?: LucideIcon;
  scroll?: boolean;
};

export function SessionNavActions({
  state,
  variant = "top-nav",
  mobileNavItems = [],
}: SessionNavActionsProps) {
  const menuId = useId();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const focusMenuOnOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const isProtectedTopNav = variant === "top-nav";
  const profileActive = pathname === ROUTES.profile;
  const nameLabel = state.fullName?.trim() || "Пользователь";
  const emailLabel = isInternalAuthEmail(state.email) ? null : state.email;

  const isEventWithinMenu = useCallback((event: Event) => {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    const containerNode = containerRef.current;
    const menuNode = menuRef.current;

    if (path.length > 0) {
      return path.some((node) => node === containerNode || node === menuNode);
    }

    const target = event.target as Node | null;
    return Boolean(
      target && (containerNode?.contains(target) || menuNode?.contains(target)),
    );
  }, []);

  const menuItems = useCallback(() => {
    if (!menuRef.current) return [];
    return Array.from(
      menuRef.current.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
      ),
    ).filter((item) => item.getClientRects().length > 0);
  }, []);

  const focusMenuItem = useCallback(
    (position: "first" | "last") => {
      const items = menuItems();
      const item = position === "first" ? items[0] : items.at(-1);
      item?.focus();
    },
    [menuItems],
  );

  const closeMenu = useCallback((returnFocus = false) => {
    focusMenuOnOpenRef.current = false;
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    } else {
      triggerRef.current?.blur();
    }
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    closeMenu();
  }, [closeMenu, pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isEventWithinMenu(event)) closeMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [closeMenu, isEventWithinMenu, open]);

  useEffect(() => {
    if (!open || !focusMenuOnOpenRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (!focusMenuOnOpenRef.current) return;
      focusMenuOnOpenRef.current = false;
      focusMenuItem("first");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusMenuItem, open]);

  useEffect(() => {
    if (!isProtectedTopNav) return;

    const desktop = window.matchMedia("(min-width: 768px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      closeMenu();
    };

    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, [closeMenu, isProtectedTopNav]);

  function handleMenuTriggerClick(event: ReactMouseEvent<HTMLButtonElement>) {
    const nextOpen = !open;
    if (!nextOpen) {
      closeMenu(event.detail === 0);
      return;
    }
    focusMenuOnOpenRef.current = nextOpen && event.detail === 0;
    setOpen(nextOpen);
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    if (items.length === 0) return;
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement,
    );
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  }

  const mobileMenu = (
    <NavigationDropdownPanel
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Меню аккаунта"
      onKeyDown={handleMenuKeyDown}
      className="nav-account-menu-mobile md:hidden"
    >
      <div className="nav-dropdown-profile">
        <AvatarImage
          avatar={state.avatar}
          initials={state.initials}
          alt=""
          size={48}
          className="nav-user-trigger-avatar nav-dropdown-profile-avatar"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {nameLabel}
          </p>
          {emailLabel ? (
            <p className="truncate text-xs text-neutral-500">{emailLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="nav-dropdown-items">
        {mobileNavItems.map((item) => (
          <PageTransitionLink
            key={item.id}
            href={item.href}
            className={navigationDropdownItemClass(
              item.active
                ? "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                : undefined,
            )}
            onClick={() => closeMenu()}
            role="menuitem"
            scroll={item.scroll}
            aria-current={item.active ? "page" : undefined}
          >
            <span className="nav-dropdown-item-content inline-flex items-center">
              {item.icon ? (
                <item.icon
                  className="nav-mobile-action-icon text-neutral-500"
                  aria-hidden="true"
                />
              ) : null}
              {item.label}
            </span>
          </PageTransitionLink>
        ))}

        <PageTransitionLink
          href={profileTabHref("profile")}
          className={navigationDropdownItemClass(
            profileActive
              ? "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
              : undefined,
          )}
          onClick={() => closeMenu()}
          role="menuitem"
          scroll={false}
          aria-current={profileActive ? "page" : undefined}
        >
          <span className="nav-dropdown-item-content inline-flex items-center">
            <UserRound
              className="nav-mobile-action-icon text-neutral-500"
              aria-hidden="true"
            />
            Профиль
          </span>
        </PageTransitionLink>
      </div>
    </NavigationDropdownPanel>
  );

  return (
    <div ref={containerRef} className="nav-session-actions relative">
      {isProtectedTopNav ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleMenuTriggerClick}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Закрыть меню аккаунта" : "Открыть меню аккаунта"}
          className="nav-user-trigger nav-account-menu-trigger inline-flex cursor-pointer items-center justify-center md:hidden"
        >
          {open ? (
            <X
              className="nav-main-menu-icon nav-mobile-action-icon"
              aria-hidden="true"
            />
          ) : (
            <Menu
              className="nav-main-menu-icon nav-mobile-action-icon"
              aria-hidden="true"
            />
          )}
        </button>
      ) : null}

      <PageTransitionLink
        href={profileTabHref("profile")}
        aria-label="Открыть профиль"
        aria-current={profileActive ? "page" : undefined}
        scroll={false}
        className={`nav-user-trigger nav-profile-link cursor-pointer items-center justify-center ${isProtectedTopNav ? "hidden md:inline-flex" : "inline-flex"}`}
      >
        <AvatarImage
          avatar={state.avatar}
          initials={state.initials}
          alt=""
          size={40}
          className="nav-user-trigger-avatar"
          priority
        />
      </PageTransitionLink>

      {isProtectedTopNav && open ? mobileMenu : null}
    </div>
  );
}
