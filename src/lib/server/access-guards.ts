import { ROUTES } from "../auth";
import type { AccessResolution } from "./access-policy";

export function resolveAppLayoutRedirect(status: AccessResolution["status"]) {
  if (status === "guest" || status === "degraded") {
    return ROUTES.login;
  }

  return null;
}

export function resolveProfileRequiredRedirect(
  status: AccessResolution["status"],
) {
  if (status === "adult-without-profile") {
    return ROUTES.onboarding;
  }

  return resolveAppLayoutRedirect(status);
}

export function resolveAuthEntryRedirect(status: AccessResolution["status"]) {
  if (status === "adult-without-profile") {
    return ROUTES.onboarding;
  }

  if (status === "adult-with-profile" || status === "student") {
    return ROUTES.dashboard;
  }

  return null;
}

export function resolveOnboardingRedirect(
  status: AccessResolution["status"],
  options?: { mode?: string | null },
) {
  if (status === "guest" || status === "degraded") {
    return ROUTES.login;
  }

  if (status === "student") {
    return ROUTES.dashboard;
  }

  if (
    status === "adult-with-profile" &&
    (options?.mode === null ||
      options?.mode === undefined ||
      options.mode !== "add-profile")
  ) {
    return ROUTES.dashboard;
  }

  return null;
}
