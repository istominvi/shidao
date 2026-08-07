import { NextRequest, NextResponse } from "next/server";
import {
  assertAction,
  identityMutationRateLimit,
} from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ learnerProfileId: string; action: string }>;
};

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "learner-directory-action",
  );
  if (limited) return limited;
  try {
    const { learnerProfileId, action: rawAction } = await params;
    const action = assertAction(rawAction, [
      "restore",
      "permanent-delete",
    ] as const);
    const { actor, service } = await getLearnerIdentityContext();
    if (action === "restore") {
      return NextResponse.json({
        learner: await service.restoreTeacherLearner(actor, learnerProfileId),
      });
    }
    await service.permanentlyDeleteOfflineLearner(actor, learnerProfileId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
