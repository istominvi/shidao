import { ROUTES } from "./auth";
import { isSafeRelativePath } from "./routes";
import type { AccessResolution } from "./server/access-policy";

function toSafePath(input: string | null | undefined, fallback: string) {
  if (!isSafeRelativePath(input)) return fallback;
  return input;
}

export function afterLogin(redirectTo?: string | null) {
  return toSafePath(redirectTo, ROUTES.courses);
}

export function resolveClientPostLoginRoute(
  serverRoute: string,
  requestedRoute?: string | null,
) {
  return typeof requestedRoute === "string" &&
    isSafeRelativePath(requestedRoute)
    ? requestedRoute
    : serverRoute;
}

export function afterSignup(params: {
  requiresEmailConfirmation: boolean;
  email: string;
  next?: string | null;
  hasSession?: boolean;
}) {
  const next = toSafePath(params.next, ROUTES.courses);

  if (params.requiresEmailConfirmation) {
    const search = new URLSearchParams({ email: params.email, next });
    return `${ROUTES.joinCheckEmail}?${search.toString()}`;
  }

  if (params.hasSession) return next;

  const search = new URLSearchParams({ registered: "1", next });
  return `${ROUTES.login}?${search.toString()}`;
}

export function afterConfirm(type: string) {
  switch (type) {
    case "signup":
    case "email":
      return ROUTES.courses;
    case "invite":
      return ROUTES.onboarding;
    case "recovery":
      return ROUTES.resetPassword;
    case "email_change":
      return `${ROUTES.settingsProfile}?emailChanged=1`;
    default:
      return `${ROUTES.login}?confirmed=0`;
  }
}

export function afterRecovery() {
  return `${ROUTES.login}?passwordReset=1`;
}

export function afterLogout() {
  return ROUTES.login;
}

export function onAuthPageWhenAuthenticated(resolution: AccessResolution) {
  return resolution.status === "account" ? ROUTES.courses : null;
}
