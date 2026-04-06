import { ROUTES } from "../auth";
import { isRouteWithin } from "../routes";
import type { AccessResolution } from "./access-policy";

export function resolvePrivateLayoutRedirect(
  status: AccessResolution["status"],
  pathname: string | null,
) {
  if (status === "guest" || status === "degraded") {
    return ROUTES.login;
  }

  if (status !== "adult-without-profile") {
    return null;
  }

  if (!pathname) {
    return null;
  }

  return isRouteWithin(pathname, ROUTES.onboarding) ? null : ROUTES.onboarding;
}

export function resolveProfileRequiredRedirect(status: AccessResolution["status"]) {
  if (status === "guest" || status === "degraded") {
    return ROUTES.login;
  }

  if (status === "adult-without-profile") {
    return ROUTES.onboarding;
  }

  return null;
}
