import { ROUTES } from "./auth";
import { isProtectedAppRoute } from "./routes";
import type {
  SessionAccountView,
  SessionDegradedView,
  SessionGuestView,
  SessionView,
} from "./session-view";

export type HeaderNavAction =
  "session-actions" | "guest-login" | "guest-join" | "skeleton";
export type LandingNavAction =
  "session-actions" | "guest-cta-pair" | "skeleton";

export function canRenderSessionNavActions(
  session: SessionView,
): session is SessionAccountView {
  return session.kind === "account";
}

export function resolveTopNavAction(
  pathname: string | null,
  session: SessionView,
  sessionResolved: boolean,
): HeaderNavAction {
  if (canRenderSessionNavActions(session)) {
    return "session-actions";
  }

  if (!sessionResolved || isProtectedAppRoute(pathname)) {
    return "skeleton";
  }

  return pathname === ROUTES.login ? "guest-join" : "guest-login";
}

export function resolveLandingNavAction(
  session: SessionView,
  sessionResolved: boolean,
): LandingNavAction {
  if (canRenderSessionNavActions(session)) {
    return "session-actions";
  }

  return sessionResolved ? "guest-cta-pair" : "skeleton";
}

export function resolveLandingAuthCtaHref(session: SessionView) {
  return canRenderSessionNavActions(session) ? ROUTES.courses : ROUTES.login;
}

export function shouldRedirectSecuritySettingsToLogin(
  session: SessionView,
): session is SessionGuestView | SessionDegradedView {
  return session.kind === "guest" || session.kind === "degraded";
}
