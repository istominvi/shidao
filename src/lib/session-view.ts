type SessionIdentity = {
  fullName?: string | null;
  email?: string | null;
  initials?: string;
};

export type SessionGuestView = {
  kind: "guest";
  authenticated: false;
};

export type SessionAccountView = SessionIdentity & {
  kind: "account";
  authenticated: true;
  hasPin: boolean;
  locale: string;
  timezone: string;
};

export type SessionDegradedView = SessionIdentity & {
  kind: "degraded";
  authenticated: true;
  reason?: string;
};

export type SessionView =
  SessionGuestView | SessionAccountView | SessionDegradedView;

export const GUEST_SESSION_VIEW: SessionGuestView = {
  kind: "guest",
  authenticated: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickIdentity(input: Record<string, unknown>): SessionIdentity {
  return {
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

export function toSessionView(input: unknown): SessionView {
  if (!isRecord(input) || typeof input.kind !== "string") {
    return GUEST_SESSION_VIEW;
  }

  switch (input.kind) {
    case "guest":
      return GUEST_SESSION_VIEW;
    case "account":
      if (
        input.authenticated !== true ||
        typeof input.hasPin !== "boolean" ||
        typeof input.locale !== "string" ||
        typeof input.timezone !== "string"
      ) {
        return GUEST_SESSION_VIEW;
      }
      return {
        kind: "account",
        authenticated: true,
        hasPin: input.hasPin,
        locale: input.locale,
        timezone: input.timezone,
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
