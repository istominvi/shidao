import { cache } from "react";
import { getCurrentAccountAuthContext } from "@/lib/server/account-auth";
import { isSessionRevoked, readAppSession } from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import { requireSupabaseUserAccessToken } from "@/lib/server/supabase-user-session";

export type AccountContext = Awaited<
  ReturnType<typeof getCurrentAccountAuthContext>
>;

export type AccessResolution =
  | { status: "guest" }
  | { status: "account"; context: AccountContext }
  | { status: "degraded"; reason: string };

/**
 * Resolves every authenticated request through the universal Account boundary.
 * No legacy parent/teacher/student table, profile preference, or role metadata
 * participates in authentication or route authorization.
 */
export const resolveAccessPolicy = cache(
  async (): Promise<AccessResolution> => {
    const session = await readAppSession();
    if (!session) return { status: "guest" };

    try {
      const accessToken = await requireSupabaseUserAccessToken();
      const account = await getCurrentAccountAuthContext(accessToken);
      if (account.authUserId !== session.uid) {
        throw new Error(
          "Account context does not match the authenticated session.",
        );
      }

      if (isSessionRevoked(session.iat, account.sessionsInvalidBefore)) {
        return { status: "guest" };
      }

      return {
        status: "account",
        context: account,
      };
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Unknown Account access resolution error";
      logger.error("[access-policy] Account resolution failed", {
        reason,
        error,
      });
      return { status: "degraded", reason };
    }
  },
);
