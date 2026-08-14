"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, LogOut, Menu, Settings } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isInternalAuthEmail, ROUTES } from "@/lib/auth";
import { signOutViaServer } from "@/lib/auth-flow";
import { useSessionView } from "@/components/use-session-view";
import type { SessionAccountView } from "@/lib/session-view";
import {
  NavigationDropdownPanel,
  navigationDropdownItemClass,
} from "@/components/navigation/primitives";
import { PageTransitionLink } from "@/components/navigation/page-transition-link";

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
  const router = useRouter();
  const { refetchSession } = useSessionView();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isEventWithinMenu(event)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isEventWithinMenu, open]);

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

  const menu = (
    <NavigationDropdownPanel
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Меню пользователя"
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
        <div className="nav-dropdown-avatar" aria-hidden="true">
          {state.initials ?? "U"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {state.fullName ?? "Пользователь"}
          </p>
          {emailLabel ? (
            <p className="truncate text-xs text-neutral-500">{emailLabel}</p>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div
          aria-live="assertive"
          className="mx-3 mb-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-700"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      <div className="border-t border-black/5 px-1 py-1.5">
        {mobileNavItems.length > 0 ? (
          <div className="mb-1 md:hidden">
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
          </div>
        ) : null}
        {mobileNavItems.length > 0 ? (
          <div
            className="my-0.5 border-t border-black/5 md:hidden"
            aria-hidden="true"
          />
        ) : null}
        <Link
          href={ROUTES.learningProfile}
          className={navigationDropdownItemClass()}
          onClick={() => setOpen(false)}
          role="menuitem"
        >
          <span className="inline-flex items-center gap-2.5">
            <BookOpenCheck
              size={16}
              className="text-neutral-500"
              aria-hidden="true"
            />
            Учебный профиль
          </span>
        </Link>
        <Link
          href={ROUTES.settingsProfile}
          className={navigationDropdownItemClass()}
          onClick={() => setOpen(false)}
          role="menuitem"
        >
          <span className="inline-flex items-center gap-2.5">
            <Settings
              size={16}
              className="text-neutral-500"
              aria-hidden="true"
            />
            Настройки
          </span>
        </Link>

        <button
          className={navigationDropdownItemClass("text-neutral-700")}
          onClick={handleSignOut}
          disabled={actionLoading === "signout"}
          aria-busy={actionLoading === "signout"}
          role="menuitem"
          type="button"
        >
          <span className="inline-flex items-center gap-2.5">
            <LogOut size={16} className="text-neutral-500" aria-hidden="true" />
            {actionLoading === "signout" ? "Выход…" : "Выход"}
          </span>
        </button>
      </div>
    </NavigationDropdownPanel>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={
          variant === "top-nav" ? "Открыть меню пользователя" : undefined
        }
        className={`nav-user-trigger inline-flex cursor-pointer items-center gap-1.5 ${variant === "landing" ? "w-full justify-center sm:w-auto" : ""}`}
      >
        {variant === "top-nav" ? (
          <span className="inline-flex md:hidden" aria-hidden="true">
            <Menu size={18} />
          </span>
        ) : null}
        <span
          className={`nav-user-trigger-avatar size-6 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white ${variant === "top-nav" ? "hidden md:inline-flex" : "inline-flex"}`}
        >
          {state.initials ?? "U"}
        </span>
        {variant !== "top-nav" ? (
          <span className="sr-only">Открыть меню пользователя</span>
        ) : null}
        {variant === "top-nav" ? (
          <span className="sr-only md:hidden">Открыть меню пользователя</span>
        ) : null}
        <span className="nav-user-trigger-name hidden max-w-[16ch] truncate text-sm font-semibold leading-tight text-neutral-900 md:block">
          {state.fullName ?? "Пользователь"}
        </span>
      </button>

      {open && (portalMenu ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
