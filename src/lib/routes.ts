import { ROUTES } from './auth';

export const ROUTE_PREFIXES = {
  settings: '/settings'
} as const;

export const PRIVATE_ROUTE_PREFIXES = [ROUTES.dashboard, ROUTES.onboarding, ROUTE_PREFIXES.settings] as const;

export function isRouteWithin(pathname: string | null | undefined, prefix: string) {
  if (!pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedAppRoute(pathname: string | null | undefined) {
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => isRouteWithin(pathname, prefix));
}

export function isGuardedAuthRoute(pathname: string | null | undefined) {
  return pathname === ROUTES.login || pathname === ROUTES.join;
}
