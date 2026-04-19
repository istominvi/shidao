import { ROUTES } from "./auth";

export const PRIVATE_ROUTE_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.schedule,
  ROUTES.homework,
  ROUTES.onboarding,
  ROUTES.settings,
  ROUTES.lessons,
  ROUTES.methodologies,
  ROUTES.groups,
] as const;

export function isRouteWithin(
  pathname: string | null | undefined,
  prefix: string,
) {
  if (!pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isSettingsRoute(pathname: string | null | undefined) {
  return isRouteWithin(pathname, ROUTES.settings);
}
export function isProtectedAppRoute(pathname: string | null | undefined) {
  return PRIVATE_ROUTE_PREFIXES.some((prefix) =>
    isRouteWithin(pathname, prefix),
  );
}

export function isGuardedAuthRoute(pathname: string | null | undefined) {
  return pathname === ROUTES.login || pathname === ROUTES.join;
}

export function isSafeRelativePath(
  pathname: string | null | undefined,
): pathname is `/${string}` {
  return Boolean(
    pathname && pathname.startsWith("/") && !pathname.startsWith("//"),
  );
}
