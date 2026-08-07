import { ROUTES } from "../auth";
import type { AccessResolution } from "./access-policy";

export function resolveAppLayoutRedirect(status: AccessResolution["status"]) {
  return status === "guest" || status === "degraded" ? ROUTES.login : null;
}

/** Compatibility name for the existing route-group folder; it is Account-only. */
export function resolveProfileRequiredRedirect(
  status: AccessResolution["status"],
) {
  return resolveAppLayoutRedirect(status);
}

/** Compatibility name for the existing route-group folder; no teacher role is checked. */
export function resolveTeacherRequiredRedirect(
  resolution: Pick<AccessResolution, "status">,
) {
  return resolveAppLayoutRedirect(resolution.status);
}

export function resolveAuthEntryRedirect(
  resolution: Pick<AccessResolution, "status">,
) {
  return resolution.status === "account" ? ROUTES.courses : null;
}

export function resolveOnboardingRedirect(status: AccessResolution["status"]) {
  return resolveAppLayoutRedirect(status);
}
