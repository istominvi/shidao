import { ROUTES } from "../auth";

export const PROFILE_TAB_IDS = [
  "profile",
  "history",
  "skills",
  "recommendations",
  "attestation",
  "observers",
  "settings",
] as const;

export type ProfileTab = (typeof PROFILE_TAB_IDS)[number];

export type ProfileRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const PROFILE_NAV_ITEMS: ReadonlyArray<{
  id: ProfileTab;
  label: string;
}> = [
  { id: "profile", label: "Профиль" },
  { id: "history", label: "История" },
  { id: "skills", label: "Навыки" },
  { id: "recommendations", label: "Рекомендации" },
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
  return tab === "profile" ? ROUTES.profile : `${ROUTES.profile}?tab=${tab}`;
}

export function profileSettingsStatusHref(
  status: "emailChanged" | "emailChangeRequested",
) {
  return `${profileTabHref("settings")}&${status}=1`;
}

/**
 * Carries legacy route search parameters into the canonical profile URL.
 * A compatibility route may force its corresponding tab while retaining all
 * unrelated flags and repeated parameters. Fragments are appended last so
 * `/settings/security` can keep its direct section target.
 */
export function profileCompatibilityHref(
  searchParams: ProfileRouteSearchParams,
  options: { tab?: ProfileTab; fragment?: string } = {},
) {
  const query = new URLSearchParams();

  if (options.tab && options.tab !== "profile") {
    query.append("tab", options.tab);
  }

  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (options.tab && key === "tab") continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value !== undefined) query.append(key, value);
    }
  }

  const queryString = query.toString();
  const fragment = options.fragment
    ? `#${encodeURIComponent(options.fragment)}`
    : "";
  return `${ROUTES.profile}${queryString ? `?${queryString}` : ""}${fragment}`;
}
