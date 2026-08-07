import { toInitials } from "@/lib/auth";
import { GUEST_SESSION_VIEW, type SessionView } from "@/lib/session-view";
import { resolveAccessPolicy } from "@/lib/server/access-policy";

export async function readSessionViewServer(): Promise<SessionView> {
  const resolution = await resolveAccessPolicy();

  switch (resolution.status) {
    case "guest":
      return GUEST_SESSION_VIEW;
    case "degraded":
      return {
        kind: "degraded",
        authenticated: true,
        reason: "context_unavailable",
      };
    case "account": {
      const ctx = resolution.context;
      return {
        kind: "account",
        authenticated: true,
        hasPin: ctx.hasPin,
        fullName: ctx.fullName,
        email: ctx.email,
        initials: toInitials(ctx.fullName, ctx.email),
        locale: ctx.locale,
        timezone: ctx.timezone,
      };
    }
    default: {
      const _never: never = resolution;
      return _never;
    }
  }
}
