import { type ProfileKind } from "@/lib/auth";
import { readAppSession } from "@/lib/server/app-session";
import {
  ensureUserPreference,
  getUserContextById,
  setLastActiveProfile,
} from "@/lib/server/supabase-admin";

export type UserContext = Awaited<ReturnType<typeof getUserContextById>>;

export type AccessResolution =
  | { status: "guest" }
  | { status: "student"; context: UserContext }
  | {
      status: "adult-with-profile";
      context: UserContext;
      activeProfile: ProfileKind;
    }
  | { status: "adult-without-profile"; context: UserContext }
  | { status: "degraded"; reason: string };

function deriveActiveProfile(context: UserContext): ProfileKind | null {
  if (context.activeProfile) return context.activeProfile;

  const fallback = context.availableAdultProfiles.at(0) ?? null;
  if (fallback) {
    context.activeProfile = fallback;
    return fallback;
  }

  return null;
}

async function normalizeAdultContext(context: UserContext) {
  try {
    await ensureUserPreference(context.userId);
  } catch (error) {
    console.error("[access-policy] ensureUserPreference failed", {
      userId: context.userId,
      error,
    });
  }

  if (
    context.availableAdultProfiles.length === 2 &&
    !context.preferences?.last_active_profile
  ) {
    try {
      await setLastActiveProfile(context.userId, "parent");
      context.activeProfile = "parent";
    } catch (error) {
      console.error("[access-policy] setLastActiveProfile failed", {
        userId: context.userId,
        error,
      });
    }
  }
}

export async function resolveAccessPolicy(): Promise<AccessResolution> {
  const session = await readAppSession();
  if (!session) {
    return { status: "guest" };
  }

  try {
    const context = await getUserContextById(session.uid, {
      email: session.email,
      fullName: session.fullName,
    });

    if (context.actorKind === "student") {
      return { status: "student", context };
    }

    await normalizeAdultContext(context);

    if (!context.hasAnyAdultProfile) {
      return { status: "adult-without-profile", context };
    }

    const activeProfile = deriveActiveProfile(context);
    if (!activeProfile) {
      return {
        status: "degraded",
        reason: "adult profile exists but active profile is unavailable",
      };
    }

    return { status: "adult-with-profile", context, activeProfile };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Unknown access resolution error";
    console.error("[access-policy] resolve failed", { reason, error });
    return { status: "degraded", reason };
  }
}
