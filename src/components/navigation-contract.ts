import { ROUTES } from '../lib/auth';
import { isProtectedAppRoute } from '../lib/routes';
import type { SessionAdultView, SessionDegradedView, SessionGuestView, SessionStudentView, SessionView } from '../lib/session-view';

export type HeaderNavAction = 'session-actions' | 'guest-login' | 'guest-join' | 'skeleton';
export type LandingNavAction = 'session-actions' | 'guest-cta-pair' | 'skeleton';

export function canRenderSessionNavActions(
  session: SessionView
): session is SessionAdultView | SessionStudentView {
  return session.kind === 'adult' || session.kind === 'student';
}

export function resolveTopNavAction(pathname: string | null, session: SessionView, sessionResolved: boolean): HeaderNavAction {
  if (canRenderSessionNavActions(session)) {
    return 'session-actions';
  }

  if (!sessionResolved || isProtectedAppRoute(pathname)) {
    return 'skeleton';
  }

  return pathname === ROUTES.login ? 'guest-join' : 'guest-login';
}

export function resolveLandingNavAction(session: SessionView, sessionResolved: boolean): LandingNavAction {
  if (canRenderSessionNavActions(session)) {
    return 'session-actions';
  }

  return sessionResolved ? 'guest-cta-pair' : 'skeleton';
}

export function resolveLandingAuthCtaHref(session: SessionView) {
  return canRenderSessionNavActions(session) ? ROUTES.dashboard : ROUTES.login;
}

export function shouldRedirectSecuritySettingsToLogin(
  session: SessionView
): session is SessionGuestView | SessionDegradedView {
  return session.kind === 'guest' || session.kind === 'degraded';
}
