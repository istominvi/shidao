import { NextRequest, NextResponse } from "next/server";
import { identityMutationRateLimit } from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = { params: Promise<{ grantId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "learner-credential-recovery-revoke",
    8,
  );
  if (limited) return limited;
  try {
    const { grantId } = await params;
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({
      delegate: await service.revokeMyRecoveryDelegate(actor, grantId),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
