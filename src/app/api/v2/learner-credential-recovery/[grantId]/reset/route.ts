import { NextRequest, NextResponse } from "next/server";
import {
  identityMutationRateLimit,
  readIdentityJson,
} from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = { params: Promise<{ grantId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "learner-credential-recovery-reset",
    5,
  );
  if (limited) return limited;
  try {
    const { grantId } = await params;
    const context = await getLearnerIdentityContext();
    return NextResponse.json({
      result: await context.service.resetRecoverableCredentials(
        context.actor,
        grantId,
        await readIdentityJson(request),
        { reauthenticatedAt: context.reauthenticatedAt },
      ),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
