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
    case "student": {
      const ctx = resolution.context;
      return {
        kind: "student",
        authenticated: true,
        hasPin: ctx.hasPin,
        userId: ctx.userId,
        fullName: ctx.fullName,
        email: ctx.email,
        initials: toInitials(ctx.fullName, ctx.email),
      };
    }
    case "adult-with-profile":
    case "adult-without-profile": {
      const ctx = resolution.context;
      return {
        kind: "adult",
        authenticated: true,
        hasPin: ctx.hasPin,
        userId: ctx.userId,
        fullName: ctx.fullName,
        email: ctx.email,
        initials: toInitials(ctx.fullName, ctx.email),
        availableProfiles: ctx.availableAdultProfiles,
        activeProfile: ctx.activeProfile,
      };
    }
    default: {
      const _never: never = resolution;
      return _never;
    }
  }
}
