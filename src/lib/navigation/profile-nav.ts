import { ROUTES } from "../auth";

export const PROFILE_TAB_IDS = [
  "profile",
  "history",
  "attestation",
  "observers",
  "settings",
] as const;

export type ProfileTab = (typeof PROFILE_TAB_IDS)[number];

export const PROFILE_NAV_ITEMS: ReadonlyArray<{
  id: ProfileTab;
  label: string;
}> = [
  { id: "profile", label: "Профиль" },
  { id: "history", label: "История" },
  { id: "attestation", label: "Аттестация" },
  { id: "observers", label: "Наблюдатели" },
  { id: "settings", label: "Настройки" },
];

export function resolveProfileTab(
  value: string | string[] | null | undefined,
): ProfileTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PROFILE_TAB_IDS.includes(candidate as ProfileTab)
    ? (candidate as ProfileTab)
    : "profile";
}

export function profileTabHref(tab: ProfileTab) {
  return tab === "profile"
    ? ROUTES.learningProfile
    : `${ROUTES.learningProfile}?tab=${tab}`;
}

export function profileSettingsStatusHref(
  status: "emailChanged" | "emailChangeRequested",
) {
  return `${profileTabHref("settings")}&${status}=1`;
}
