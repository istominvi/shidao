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

  if (status === "adult-without-profile") {
    if (!pathname) {
      return null;
    }

    if (!isRouteWithin(pathname, ROUTES.onboarding)) {
      return ROUTES.onboarding;
    }
  }

  return null;
}

export function resolveUserContextRedirect(status: AccessResolution["status"]) {
  if (status === "guest") {
    return ROUTES.login;
  }

  if (status === "adult-without-profile") {
    return ROUTES.onboarding;
  }

  return null;
}
