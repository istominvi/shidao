import { toInitials } from "@/lib/auth";
import { GUEST_SESSION_VIEW, type SessionView } from "@/lib/session-view";
import { readAppSession } from "@/lib/server/app-session";
import { getUserContextById } from "@/lib/server/supabase-admin";

export async function readSessionViewServer(): Promise<SessionView> {
  const session = await readAppSession();
  if (!session) {
    return GUEST_SESSION_VIEW;
  }

  try {
    const ctx = await getUserContextById(session.uid, {
      email: session.email,
      fullName: session.fullName,
    });

    if (ctx.actorKind === "student") {
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
  } catch (error) {
    console.error("[session-view] failed to resolve user context", {
      userId: session.uid,
      error,
    });
    return {
      kind: "degraded",
      authenticated: true,
      reason: "context_unavailable",
      userId: session.uid,
      email: session.email,
      fullName: session.fullName,
      initials: toInitials(session.fullName, session.email),
    };
  }
}
