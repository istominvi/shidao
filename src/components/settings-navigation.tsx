"use client";

import { usePathname } from "next/navigation";
import { useSessionView } from "@/components/use-session-view";
import { NavPillLink } from "@/components/navigation/primitives";
import { SETTINGS_NAV_SECTIONS } from "@/lib/navigation/settings-nav";

export function SettingsNavigation() {
  const pathname = usePathname();
  const { state } = useSessionView();
  const isAdult = state.kind === "adult";

  return (
    <nav className="glass nav-settings-shell" aria-label="Навигация по настройкам">
      {SETTINGS_NAV_SECTIONS.map((section, sectionIndex) => {
        if (section.adultOnly && !isAdult) {
          return null;
        }

        return (
          <div
            key={section.id}
            className={sectionIndex === 0 ? "space-y-1" : "mt-4 space-y-1 border-t border-black/10 pt-3"}
          >
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {section.title}
            </p>
            {section.items.map((item) => {
              const active = item.isActive(pathname);
              return (
                <NavPillLink
                  key={item.id}
                  href={item.href}
                  active={active}
                  ariaCurrent={active ? "page" : undefined}
                  className="flex min-h-10 rounded-xl px-3 text-sm font-medium"
                >
                  {item.label}
                </NavPillLink>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
