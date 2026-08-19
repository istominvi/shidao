import { ROUTES } from "../auth";
import type { AccessResolution } from "./access-policy";

export function resolveAppLayoutRedirect(status: AccessResolution["status"]) {
  return status === "guest" || status === "degraded" ? ROUTES.login : null;
}

export function resolveAuthEntryRedirect(
  resolution: Pick<AccessResolution, "status">,
) {
  return resolution.status === "account" ? ROUTES.courses : null;
}

export function resolveOnboardingRedirect(status: AccessResolution["status"]) {
  return resolveAppLayoutRedirect(status);
}
