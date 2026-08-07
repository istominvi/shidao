import { NextRequest, NextResponse } from "next/server";
import { identityMutationRateLimit } from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limited = identityMutationRateLimit(request, "learner-share-code", 6);
  if (limited) return limited;
  try {
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({
      shareCode: await service.rotateShareCode(actor),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
