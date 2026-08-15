import { clearAppSession, isSessionRevoked } from "@/lib/server/app-session";
import { getCurrentAccountAuthContext } from "@/lib/server/account-auth";
import { primaryHeaderSummaryOwnerKey } from "@/lib/navigation/primary-header-summary-owner";
import { createPrimaryHeaderSummaryRepository } from "@/lib/navigation/primary-header-summary-repository";
import {
  requireSupabaseUserSession,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import { createLearnerIdentityAdminRepository } from "@/modules/learner-identity/admin-repository";
import { createLearnerIdentityRepository } from "@/modules/learner-identity/repository";
import { createLearnerIdentityService } from "@/modules/learner-identity/service";

/**
 * Builds the compact count repository and identity reads from one validated
 * user JWT. It must not call multiple existing context factories: each may
 * independently rotate the same refresh token inside the refresh skew.
 */
export async function getPrimaryHeaderSummaryContext() {
  const { accessToken, session } = await requireSupabaseUserSession();
  const account = await getCurrentAccountAuthContext(accessToken);

  if (
    account.authUserId !== session.uid ||
    isSessionRevoked(session.iat, account.sessionsInvalidBefore)
  ) {
    await clearAppSession();
    throw new SupabaseUserReauthenticationRequiredError();
  }

  return {
    ownerKey: primaryHeaderSummaryOwnerKey(session.uid),
    counts: createPrimaryHeaderSummaryRepository(accessToken),
    identity: {
      actor: {
        authUserId: session.uid,
        verifiedEmail: account.verifiedEmail,
      },
      service: createLearnerIdentityService({
        repository: createLearnerIdentityRepository(accessToken),
        adminRepository: createLearnerIdentityAdminRepository(),
      }),
    },
  };
}
