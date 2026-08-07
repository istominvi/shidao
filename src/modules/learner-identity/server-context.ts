import { NextResponse } from "next/server";
import {
  clearAppSession,
  isRecentReauthentication,
  isSessionRevoked,
  readAppSession,
} from "@/lib/server/app-session";
import { getCurrentAccountAuthContext } from "@/lib/server/account-auth";
import {
  isSupabaseUserReauthenticationRequiredError,
  requireSupabaseUserAccessToken,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import { createLearnerIdentityAdminRepository } from "./admin-repository";
import { createLearnerIdentityRepository } from "./repository";
import {
  createLearnerIdentityService,
  LearnerIdentityApplicationError,
  type LearnerIdentityActor,
} from "./service";

export async function getLearnerIdentityContext() {
  const session = await readAppSession();
  if (!session) throw new SupabaseUserReauthenticationRequiredError();
  const accessToken = await requireSupabaseUserAccessToken();
  const account = await getCurrentAccountAuthContext(accessToken);
  if (
    account.authUserId !== session.uid ||
    isSessionRevoked(session.iat, account.sessionsInvalidBefore)
  ) {
    await clearAppSession();
    throw new SupabaseUserReauthenticationRequiredError();
  }
  const actor: LearnerIdentityActor = {
    authUserId: session.uid,
    verifiedEmail: account.verifiedEmail,
  };
  const recentlyReauthenticated = isRecentReauthentication(session);
  return {
    actor,
    recentlyReauthenticated,
    reauthenticatedAt:
      recentlyReauthenticated && session.reauthenticatedAt
        ? new Date(session.reauthenticatedAt).toISOString()
        : null,
    service: createLearnerIdentityService({
      repository: createLearnerIdentityRepository(accessToken),
      adminRepository: createLearnerIdentityAdminRepository(),
    }),
  };
}

export function learnerIdentityApiError(error: unknown) {
  if (error instanceof LearnerIdentityApplicationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (isSupabaseUserReauthenticationRequiredError(error)) {
    return NextResponse.json(
      {
        error: "Войдите снова, чтобы продолжить.",
        code: "learner_identity_reauthentication_required",
      },
      { status: 401 },
    );
  }
  return NextResponse.json(
    {
      error: "Сервис учебного профиля временно недоступен.",
      code: "learner_identity_unavailable",
    },
    { status: 503 },
  );
}
