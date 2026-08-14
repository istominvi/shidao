"use client";

import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  History,
  LogOut,
  Menu,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AvatarImage } from "@/components/account/avatar-image";
import { isInternalAuthEmail, ROUTES } from "@/lib/auth";
import { signOutViaServer } from "@/lib/auth-flow";
import { useSessionView } from "@/components/use-session-view";
import type { SessionAccountView } from "@/lib/session-view";
import {
  NavigationDropdownPanel,
  navigationDropdownItemClass,
} from "@/components/navigation/primitives";
import { PageTransitionLink } from "@/components/navigation/page-transition-link";
import {
  PROFILE_NAV_ITEMS,
  profileTabHref,
  type ProfileTab,
} from "@/lib/navigation/profile-nav";

type SessionNavActionsProps = {
  state: SessionAccountView;
  variant?: "top-nav" | "landing";
  portalMenu?: boolean;
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

type MenuPosition = { top: number; left: number; width: number };
type ActionLoadingState = "signout" | null;

const MENU_WIDTH = 288;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;

const PROFILE_MENU_ICONS: Record<ProfileTab, LucideIcon> = {
  profile: UserRound,
  history: History,
  attestation: BadgeCheck,
  observers: UsersRound,
  settings: Settings,
};

async function readActionError(
  response: Response,
  fallback: string,
): Promise<never> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  throw new Error(payload?.error ?? fallback);
}

export function SessionNavActions({
  state,
  variant = "top-nav",
  portalMenu = false,
  mobileNavItems = [],
}: SessionNavActionsProps) {
  const menuId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const { refetchSession } = useSessionView();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isProtectedTopNav = variant === "top-nav";
  const accountMenuLabel = isProtectedTopNav
    ? "Меню аккаунта"
    : "Меню пользователя";
  const accountMenuTriggerLabel = isProtectedTopNav
    ? "Открыть меню аккаунта"
    : "Открыть меню пользователя";
  const profileActive = pathname === ROUTES.profile;
  const nameLabel = state.fullName?.trim() || "Пользователь";
  const emailLabel = isInternalAuthEmail(state.email) ? null : state.email;
  const updateMenuPosition = useCallback(() => {
    if (!portalMenu || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const availableWidth = Math.max(
      window.innerWidth - VIEWPORT_PADDING * 2,
      220,
    );
    const menuWidth = Math.min(MENU_WIDTH, availableWidth);
    const maxLeft = window.innerWidth - menuWidth - VIEWPORT_PADDING;
    setMenuPosition({
      top: rect.bottom + MENU_GAP,
      left: Math.min(
        Math.max(rect.right - menuWidth, VIEWPORT_PADDING),
        maxLeft,
      ),
      width: menuWidth,
    });
  }, [portalMenu]);

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

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isEventWithinMenu(event)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isEventWithinMenu, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => focusMenuItem("first"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusMenuItem, open]);

  useEffect(() => {
    if (!open || !portalMenu) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, portalMenu, updateMenuPosition]);

  async function handleSignOut() {
    setActionLoading("signout");
    setActionError(null);

    try {
      const response = await signOutViaServer();
      if (!response.ok) {
        await readActionError(response, "Не удалось выйти из аккаунта.");
      }

      await refetchSession();
      setOpen(false);
      router.push(ROUTES.login);
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось выйти из аккаунта.",
      );
    } finally {
      setActionLoading(null);
    }
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

  const menu = (
    <NavigationDropdownPanel
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={accountMenuLabel}
      onKeyDown={handleMenuKeyDown}
      className={`w-[18rem] max-w-[calc(100vw-16px)] ${portalMenu ? "fixed z-[260]" : "absolute right-0 z-[120] mt-2"}`}
      style={
        portalMenu && menuPosition
          ? {
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }
          : undefined
      }
    >
      <div className="nav-dropdown-profile">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {nameLabel}
          </p>
          {emailLabel ? (
            <p className="truncate text-xs text-neutral-500">{emailLabel}</p>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div
          aria-live="assertive"
          className="mb-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-700"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      <div className="nav-dropdown-items">
        {isProtectedTopNav ? (
          <div className="md:hidden">
            {mobileNavItems.map((item) => (
              <PageTransitionLink
                key={item.id}
                href={item.href}
                className={navigationDropdownItemClass(
                  item.active
                    ? "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                    : undefined,
                )}
                onClick={() => setOpen(false)}
                role="menuitem"
                scroll={item.scroll}
                aria-current={item.active ? "page" : undefined}
              >
                <span className="inline-flex items-center gap-2.5">
                  {item.icon ? (
                    <item.icon
                      size={16}
                      className="text-neutral-500"
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
              onClick={() => setOpen(false)}
              role="menuitem"
              scroll={false}
              aria-current={profileActive ? "page" : undefined}
            >
              <span className="inline-flex items-center gap-2.5">
                <UserRound
                  size={16}
                  className="text-neutral-500"
                  aria-hidden="true"
                />
                Профиль
              </span>
            </PageTransitionLink>
          </div>
        ) : null}

        <div className={isProtectedTopNav ? "hidden md:block" : undefined}>
          {PROFILE_NAV_ITEMS.map((item) => {
            const Icon = PROFILE_MENU_ICONS[item.id];
            return (
              <PageTransitionLink
                key={item.id}
                href={profileTabHref(item.id)}
                className={navigationDropdownItemClass()}
                onClick={() => setOpen(false)}
                role="menuitem"
                scroll={false}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon
                    size={16}
                    className="text-neutral-500"
                    aria-hidden="true"
                  />
                  {item.label}
                </span>
              </PageTransitionLink>
            );
          })}

          <button
            className={navigationDropdownItemClass("text-neutral-700")}
            onClick={handleSignOut}
            disabled={actionLoading === "signout"}
            aria-busy={actionLoading === "signout"}
            role="menuitem"
            type="button"
          >
            <span className="inline-flex items-center gap-2.5">
              <LogOut
                size={16}
                className="text-neutral-500"
                aria-hidden="true"
              />
              {actionLoading === "signout" ? "Выход…" : "Выход"}
            </span>
          </button>
        </div>
      </div>
    </NavigationDropdownPanel>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={accountMenuTriggerLabel}
        className="nav-user-trigger inline-flex cursor-pointer items-center justify-center"
      >
        {isProtectedTopNav ? (
          <>
            <Menu className="nav-main-menu-icon md:hidden" aria-hidden="true" />
            <span className="hidden md:inline-flex">
              <AvatarImage
                avatar={state.avatar}
                initials={state.initials}
                alt=""
                size={40}
                className="nav-user-trigger-avatar"
                priority
              />
            </span>
          </>
        ) : (
          <AvatarImage
            avatar={state.avatar}
            initials={state.initials}
            alt=""
            size={40}
            className="nav-user-trigger-avatar"
            priority
          />
        )}
      </button>

      {open && (portalMenu ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
