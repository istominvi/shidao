"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { CalendarDays, LogOut, Settings } from "lucide-react";
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
};

type MenuPosition = { top: number; left: number };
type ActionLoadingState = `switch:${ProfileKind}` | "signout" | null;

const MENU_WIDTH = 288;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;
const ADULT_PROFILE_ORDER: ProfileKind[] = ["teacher", "parent"];
const ADULT_PROFILE_TOGGLE_LABELS: Record<ProfileKind, string> = {
  teacher: "Учитель",
  parent: "Родитель",
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
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING;
    setMenuPosition({
      top: rect.bottom + MENU_GAP,
      left: Math.min(Math.max(rect.right - MENU_WIDTH, VIEWPORT_PADDING), maxLeft),
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
      router.replace(ROUTES.dashboard);
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

  const menu = (
    <NavigationDropdownPanel
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Меню пользователя"
      className={`w-72 ${portalMenu ? "fixed z-[260]" : "absolute right-0 z-[120] mt-2"}`}
      style={portalMenu && menuPosition ? menuPosition : undefined}
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
                router.replace(ROUTES.dashboard);
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

      <div className="border-t border-black/5 px-1 py-1.5">
        {state.kind === "student" ? (
          <Link
            href={ROUTES.lessons}
            className={navigationDropdownItemClass()}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <span className="inline-flex items-center gap-2.5">
              <CalendarDays size={16} className="text-neutral-500" aria-hidden="true" />
              Расписание
            </span>
          </Link>
        ) : null}
        {state.kind === "student" ? (
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
        className={`nav-user-trigger inline-flex cursor-pointer items-center gap-1.5 ${variant === "landing" ? "w-full justify-center sm:w-auto" : ""}`}
      >
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">
          {state.initials ?? "U"}
        </span>
        <span className="hidden max-w-[16ch] truncate text-sm font-semibold leading-tight text-neutral-900 md:block">
          {state.fullName ?? "Пользователь"}
        </span>
      </button>

      {open && (portalMenu ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
