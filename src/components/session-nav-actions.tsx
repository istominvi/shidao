"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ROUTES, type ProfileKind } from "@/lib/auth";
import { signOutViaServer } from "@/lib/auth-flow";
import { useSessionView } from "@/components/use-session-view";
import type { SessionAdultView, SessionStudentView } from "@/lib/session-view";
import { useSessionMenuBehavior } from "@/components/session-nav/use-session-menu-behavior";
import { SessionMenuPanel } from "@/components/session-nav/session-menu-panel";

type SessionNavActionsProps = {
  state: SessionAdultView | SessionStudentView;
  variant?: "top-nav" | "landing";
  portalMenu?: boolean;
};

type ActionLoadingState = `switch:${ProfileKind}` | "signout" | null;

async function readActionError(response: Response, fallback: string): Promise<never> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
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
  const { open, setOpen, menuPosition, containerRef, menuRef } = useSessionMenuBehavior(portalMenu);
  const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      if (!response.ok) await readActionError(response, "Не удалось переключить профиль.");

      await refetchSession();
      setOpen(false);
      router.replace(ROUTES.dashboard);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось переключить профиль.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSignOut() {
    setActionLoading("signout");
    setActionError(null);

    try {
      const response = await signOutViaServer();
      if (!response.ok) await readActionError(response, "Не удалось выйти из аккаунта.");

      await refetchSession();
      setOpen(false);
      router.push(ROUTES.login);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось выйти из аккаунта.");
    } finally {
      setActionLoading(null);
    }
  }

  const menu = (
    <SessionMenuPanel
      menuId={menuId}
      portalMenu={portalMenu}
      menuPosition={menuPosition ?? undefined}
      menuRef={menuRef}
      state={state}
      actionError={actionError}
      actionLoading={actionLoading}
      onClose={() => setOpen(false)}
      onSwitch={(profile) => void handleSwitch(profile)}
      onSignOut={() => void handleSignOut()}
      onGoDashboard={() => {
        router.replace(ROUTES.dashboard);
        router.refresh();
      }}
    />
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
