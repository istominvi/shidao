import { ROUTES } from "@/lib/auth";
import { isRouteWithin } from "@/lib/routes";

export type SettingsNavSection = {
  id: string;
  title: string;
  items: Array<{
    id: string;
    label: string;
    href: string;
    isActive: (pathname: string | null) => boolean;
  }>;
};

export const SETTINGS_NAV_SECTIONS: SettingsNavSection[] = [
  {
    id: "personal",
    title: "Личное",
    items: [
      {
        id: "profile",
        label: "Профиль и email",
        href: ROUTES.settingsProfile,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.settingsProfile),
      },
      {
        id: "security",
        label: "Безопасность",
        href: ROUTES.settingsSecurity,
        isActive: (pathname) =>
          isRouteWithin(pathname, ROUTES.settingsSecurity),
      },
      {
        id: "observers",
        label: "Наблюдатели",
        href: ROUTES.settingsObservers,
        isActive: (pathname) =>
          isRouteWithin(pathname, ROUTES.settingsObservers),
      },
    ],
  },
];
