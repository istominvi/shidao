import type { RefObject } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { ROUTES, type ProfileKind } from "@/lib/auth";
import type { SessionAdultView, SessionStudentView } from "@/lib/session-view";
import {
  NavPillButton,
  NavSegmentedSwitch,
  NavigationDropdownPanel,
  navigationDropdownItemClass,
} from "@/components/navigation/primitives";

const ADULT_PROFILE_ORDER: ProfileKind[] = ["teacher", "parent"];
const ADULT_PROFILE_TOGGLE_LABELS: Record<ProfileKind, string> = {
  teacher: "Учитель",
  parent: "Родитель",
};

type MenuPanelProps = {
  menuId: string;
  portalMenu: boolean;
  menuPosition?: { top: number; left: number };
  menuRef: RefObject<HTMLDivElement | null>;
  state: SessionAdultView | SessionStudentView;
  actionError: string | null;
  actionLoading: `switch:${ProfileKind}` | "signout" | null;
  onClose: () => void;
  onSwitch: (profile: ProfileKind) => void;
  onSignOut: () => void;
  onGoDashboard: () => void;
};

export function SessionMenuPanel({
  menuId,
  portalMenu,
  menuPosition,
  menuRef,
  state,
  actionError,
  actionLoading,
  onClose,
  onSwitch,
  onSignOut,
  onGoDashboard,
}: MenuPanelProps) {
  const isSwitchBusy = actionLoading?.startsWith("switch:") ?? false;

  return (
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
          <p className="truncate text-sm font-semibold text-neutral-900">{state.fullName ?? "Пользователь"}</p>
          <p className="truncate text-xs text-neutral-500">{state.email ?? "Без email"}</p>
        </div>
      </div>

      {actionError ? (
        <div aria-live="assertive" className="mx-3 mb-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-700" role="alert">
          {actionError}
        </div>
      ) : null}

      {state.kind === "adult" ? (
        <div className="border-t border-black/5 px-3 py-2.5">
          <NavSegmentedSwitch className="w-full">
            {ADULT_PROFILE_ORDER.map((profile) => {
              const available = state.availableProfiles.includes(profile);
              const active = state.activeProfile === profile;
              const isSwitchLoading = actionLoading === `switch:${profile}`;

              return (
                <NavPillButton
                  key={profile}
                  active={active}
                  unavailable={!available}
                  loading={isSwitchLoading}
                  disabled={isSwitchBusy && !isSwitchLoading}
                  ariaPressed={active}
                  className="min-h-10 flex-1 px-2.5 text-sm font-semibold"
                  onClick={() => {
                    if (active) {
                      onClose();
                      onGoDashboard();
                      return;
                    }
                    if (available && !isSwitchBusy) onSwitch(profile);
                  }}
                >
                  {ADULT_PROFILE_TOGGLE_LABELS[profile]}
                </NavPillButton>
              );
            })}
          </NavSegmentedSwitch>
        </div>
      ) : null}

      <div className="border-t border-black/5 px-1 py-1.5">
        <Link href={ROUTES.settingsProfile} className={navigationDropdownItemClass()} onClick={onClose} role="menuitem">
          <span className="inline-flex items-center gap-2.5">
            <Settings size={16} className="text-neutral-500" aria-hidden="true" />
            Настройки
          </span>
        </Link>

        <button
          className={navigationDropdownItemClass("text-neutral-700")}
          onClick={onSignOut}
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
}
