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

  if (
    status === "adult-without-profile" &&
    !isRouteWithin(pathname, ROUTES.onboarding)
  ) {
    return ROUTES.onboarding;
  }

  return null;
}
