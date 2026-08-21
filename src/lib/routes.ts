import { ROUTES } from "./auth";

export const PRIVATE_ROUTE_PREFIXES = [
  ROUTES.onboarding,
  ROUTES.settings,
  ROUTES.schedule,
  ROUTES.students,
  ROUTES.courses,
  ROUTES.store,
  ROUTES.profile,
  ROUTES.learningProfile,
  ROUTES.observing,
  ROUTES.live,
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
  if (
    !pathname ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(pathname) ||
    /%(?:0a|0d|5c)/i.test(pathname)
  ) {
    return false;
  }

  try {
    const base = "https://safe-redirect.invalid";
    return new URL(pathname, base).origin === base;
  } catch {
    return false;
  }
}
