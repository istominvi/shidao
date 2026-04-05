import type { ProfileKind } from "@/lib/auth";

type SessionIdentity = {
  userId?: string;
  fullName?: string | null;
  email?: string | null;
  initials?: string;
};

export type SessionGuestView = {
  kind: "guest";
  authenticated: false;
};

export type SessionStudentView = SessionIdentity & {
  kind: "student";
  authenticated: true;
  hasPin: boolean;
};

export type SessionAdultView = SessionIdentity & {
  kind: "adult";
  authenticated: true;
  hasPin: boolean;
  activeProfile: ProfileKind | null;
  availableProfiles: ProfileKind[];
};

export type SessionDegradedView = SessionIdentity & {
  kind: "degraded";
  authenticated: true;
  reason?: string;
};

export type SessionView =
  | SessionGuestView
  | SessionStudentView
  | SessionAdultView
  | SessionDegradedView;

export const GUEST_SESSION_VIEW: SessionGuestView = {
  kind: "guest",
  authenticated: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickIdentity(input: Record<string, unknown>): SessionIdentity {
  return {
    userId: typeof input.userId === "string" ? input.userId : undefined,
    fullName:
      typeof input.fullName === "string" || input.fullName === null
        ? input.fullName
        : undefined,
    email:
      typeof input.email === "string" || input.email === null
        ? input.email
        : undefined,
    initials: typeof input.initials === "string" ? input.initials : undefined,
  };
}

function isProfileKind(value: unknown): value is ProfileKind {
  return value === "parent" || value === "teacher";
}

export function toSessionView(input: unknown): SessionView {
  if (!isRecord(input) || typeof input.kind !== "string") {
    return GUEST_SESSION_VIEW;
  }

  switch (input.kind) {
    case "guest":
      return GUEST_SESSION_VIEW;
    case "student":
      if (input.authenticated !== true || typeof input.hasPin !== "boolean")
        return GUEST_SESSION_VIEW;
      return {
        kind: "student",
        authenticated: true,
        hasPin: input.hasPin,
        ...pickIdentity(input),
      };
    case "adult":
      if (
        input.authenticated !== true ||
        typeof input.hasPin !== "boolean" ||
        !Array.isArray(input.availableProfiles)
      ) {
        return GUEST_SESSION_VIEW;
      }
      return {
        kind: "adult",
        authenticated: true,
        hasPin: input.hasPin,
        activeProfile: isProfileKind(input.activeProfile)
          ? input.activeProfile
          : null,
        availableProfiles: input.availableProfiles.filter(isProfileKind),
        ...pickIdentity(input),
      };
    case "degraded":
      if (input.authenticated !== true) return GUEST_SESSION_VIEW;
      return {
        kind: "degraded",
        authenticated: true,
        reason: typeof input.reason === "string" ? input.reason : undefined,
        ...pickIdentity(input),
      };
    default:
      return GUEST_SESSION_VIEW;
  }
}
