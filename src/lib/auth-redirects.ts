import { ROUTES } from '@/lib/auth';
import type { AccessResolution } from '@/lib/server/access-policy';

function toSafePath(input: string | null | undefined, fallback: string) {
  if (!input) return fallback;
  if (!input.startsWith('/') || input.startsWith('//')) return fallback;
  return input;
}

export function afterLogin(redirectTo?: string | null) {
  return toSafePath(redirectTo, ROUTES.dashboard);
}

export function afterSignup(params: { requiresEmailConfirmation: boolean; email: string }) {
  if (params.requiresEmailConfirmation) {
    return `${ROUTES.joinCheckEmail}?email=${encodeURIComponent(params.email)}`;
  }

  return `${ROUTES.login}?registered=1`;
}

export function afterConfirm(type: string) {
  switch (type) {
    case 'signup':
    case 'email':
      return `${ROUTES.login}?confirmed=1`;
    case 'recovery':
      return ROUTES.resetPassword;
    case 'invite':
      return ROUTES.onboarding;
    case 'email_change':
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
  if (resolution.status === 'adult-without-profile') {
    return ROUTES.onboarding;
  }

  if (resolution.status === 'adult-with-profile' || resolution.status === 'student') {
    return ROUTES.dashboard;
  }

  return null;
}
