import type { ProfileKind } from '@/lib/auth';

type SessionIdentity = {
  userId?: string;
  fullName?: string | null;
  email?: string | null;
  initials?: string;
};

export type SessionGuestView = {
  kind: 'guest';
  authenticated: false;
};

export type SessionStudentView = SessionIdentity & {
  kind: 'student';
  authenticated: true;
  hasPin: boolean;
};

export type SessionAdultView = SessionIdentity & {
  kind: 'adult';
  authenticated: true;
  hasPin: boolean;
  activeProfile: ProfileKind | null;
  availableProfiles: ProfileKind[];
};

export type SessionDegradedView = SessionIdentity & {
  kind: 'degraded';
  authenticated: true;
  reason?: string;
};

export type SessionView = SessionGuestView | SessionStudentView | SessionAdultView | SessionDegradedView;
