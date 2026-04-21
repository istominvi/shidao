"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut, Menu, Settings } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isStudentInternalAuthEmail, ROUTES, type ProfileKind } from "@/lib/auth";
import { signOutViaServer } from "@/lib/auth-flow";
import { useSessionView } from "@/components/use-session-view";
import type { SessionAdultView, SessionStudentView } from "@/lib/session-view";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  NavigationDropdownPanel,
  navigationDropdownItemClass,
} from "@/components/navigation/primitives";

type SessionNavActionsProps = {
  state: SessionAdultView | SessionStudentView;
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
type ActionLoadingState =
  | `switch:${ProfileKind}`
  | "signout"
  | "switch-school:personal"
  | `switch-school:${string}`
  | null;

const MENU_WIDTH = 288;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;
const ADULT_PROFILE_ORDER: ProfileKind[] = ["teacher", "parent"];
const ADULT_PROFILE_TOGGLE_LABELS: Record<ProfileKind, string> = {
  teacher: "Учитель",
  parent: "Родитель",
};
const PROFILE_HOME_ROUTE: Record<ProfileKind, string> = {
  teacher: ROUTES.lessons,
  parent: ROUTES.dashboard,
};

async function readActionError(
  response: Response,
  fallback: string,
): Promise<never> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
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
  const isSwitchBusy = actionLoading?.startsWith("switch:") ?? false;
  const shouldHideStudentInternalEmail =
    state.kind === "student" && isStudentInternalAuthEmail(state.email);
  const emailLabel = shouldHideStudentInternalEmail ? null : state.email;
  const profileItems: Array<{
    value: ProfileKind;
    label: string;
    disabled: boolean;
    busy: boolean;
  }> =
    state.kind === "adult"
      ? ADULT_PROFILE_ORDER.map((profile) => {
          const available = state.availableProfiles.includes(profile);
          const isSwitchLoading = actionLoading === `switch:${profile}`;
          return {
            value: profile,
            label: ADULT_PROFILE_TOGGLE_LABELS[profile],
            disabled: !available || (isSwitchBusy && !isSwitchLoading),
            busy: isSwitchLoading,
          };
        })
      : [];

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
      left: Math.min(Math.max(rect.right - menuWidth, VIEWPORT_PADDING), maxLeft),
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

  async function handleSwitch(profile: ProfileKind) {
    if (
      state.kind !== "adult" ||
      state.activeProfile === profile ||
      !state.availableProfiles.includes(profile)
    ) {
      return;
    }

    const loadingKey = `switch:${profile}` as const;
    setActionLoading(loadingKey);
    setActionError(null);

    try {
      const response = await fetch("/api/preferences/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!response.ok) {
        await readActionError(response, "Не удалось переключить профиль.");
      }

      await refetchSession();
      setOpen(false);
      router.replace(PROFILE_HOME_ROUTE[profile]);
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось переключить профиль.",
      );
    } finally {
      setActionLoading(null);
    }
  }

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
        error instanceof Error ? error.message : "Не удалось выйти из аккаунта.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSwitchSchool(target: "personal" | string) {
    if (state.kind !== "adult") return;
    const loadingKey: ActionLoadingState =
      target === "personal" ? "switch-school:personal" : `switch-school:${target}`;
    setActionLoading(loadingKey);
    setActionError(null);
    try {
      const response = await fetch("/api/preferences/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          target === "personal"
            ? JSON.stringify({ mode: "personal" })
            : JSON.stringify({ schoolId: target }),
      });
      if (!response.ok) {
        await readActionError(response, "Не удалось переключить школу.");
      }
      await refetchSession();
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Не удалось переключить школу.",
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

      {state.kind === "adult" ? (
        <div className="border-t border-black/5 px-3 py-2.5">
          <SegmentedControl
            ariaLabel="Активный профиль"
            value={state.activeProfile}
            onChange={(profile) => {
              if (profile === state.activeProfile) {
                setOpen(false);
                router.replace(PROFILE_HOME_ROUTE[profile]);
                router.refresh();
                return;
              }

              const available = state.availableProfiles.includes(profile);
              if (available && !isSwitchBusy) {
                void handleSwitch(profile);
              }
            }}
            items={profileItems}
          />
        </div>
      ) : null}

      {state.kind === "adult" && state.activeProfile === "teacher" ? (
        <div className="border-t border-black/5 px-3 py-2.5">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Школа
          </p>
          <button
            type="button"
            className={navigationDropdownItemClass()}
            onClick={() => void handleSwitchSchool("personal")}
          >
            Лично
          </button>
          {(state.schoolOptions ?? [])
            .filter((option) => option.kind === "organization")
            .map((option) => (
              <button
                key={option.id}
                type="button"
                className={navigationDropdownItemClass()}
                onClick={() => void handleSwitchSchool(option.id)}
              >
                {option.label}
              </button>
            ))}
          <Link
            href={`${ROUTES.school}?create=1`}
            className={navigationDropdownItemClass()}
            onClick={() => setOpen(false)}
          >
            Создать школу
          </Link>
        </div>
      ) : null}

      <div className="border-t border-black/5 px-1 py-1.5">
        {mobileNavItems.length > 0 ? (
          <div className="mb-1 md:hidden">
            {mobileNavItems.map((item) => (
              <Link
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
              </Link>
            ))}
          </div>
        ) : null}
        {mobileNavItems.length > 0 ? (
          <div className="my-1 border-t border-black/5" aria-hidden="true" />
        ) : null}
        <Link
          href={ROUTES.settingsProfile}
          className={navigationDropdownItemClass()}
          onClick={() => setOpen(false)}
          role="menuitem"
        >
          <span className="inline-flex items-center gap-2.5">
            <Settings size={16} className="text-neutral-500" aria-hidden="true" />
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
        aria-label={variant === "top-nav" ? "Открыть меню пользователя" : undefined}
        className={`nav-user-trigger inline-flex cursor-pointer items-center gap-1.5 ${variant === "landing" ? "w-full justify-center sm:w-auto" : ""}`}
      >
        {variant === "top-nav" ? (
          <span className="inline-flex md:hidden" aria-hidden="true">
            <Menu size={18} />
          </span>
        ) : null}
        <span
          className={`size-6 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white ${variant === "top-nav" ? "hidden md:inline-flex" : "inline-flex"}`}
        >
          {state.initials ?? "U"}
        </span>
        {variant !== "top-nav" ? (
          <span className="sr-only">Открыть меню пользователя</span>
        ) : null}
        {variant === "top-nav" ? (
          <span className="sr-only md:hidden">Открыть меню пользователя</span>
        ) : null}
        <span className="hidden max-w-[16ch] truncate text-sm font-semibold leading-tight text-neutral-900 md:block">
          {state.fullName ?? "Пользователь"}
        </span>
      </button>

      {open && (portalMenu ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
