import type { ProfileKind } from '@/lib/auth';

export type SessionView = {
  authenticated: boolean;
  fullName?: string | null;
  email?: string | null;
  initials?: string;
  actorKind?: 'adult' | 'student';
  availableAdultProfiles?: ProfileKind[];
  activeProfile?: ProfileKind | null;
  userId?: string;
  hasAnyAdultProfile?: boolean;
  hasPin?: boolean;
  contextResolved?: boolean;
  reason?: string;
};
