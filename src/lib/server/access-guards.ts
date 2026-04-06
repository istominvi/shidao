import { ROUTES } from "../auth";
import type { AccessResolution } from "./access-policy";

export function resolvePrivateLayoutRedirect(status: AccessResolution["status"]) {
  if (status === "guest" || status === "degraded") {
    return ROUTES.login;
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
