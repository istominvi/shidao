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
type Context = { params: Promise<{ learnerProfileId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({
      invitations: await service.listProfileInvitations(
        actor,
        learnerProfileId,
      ),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "learner-invitation-create",
    8,
  );
  if (limited) return limited;
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(
      await service.createProfileInvitation(
        actor,
        learnerProfileId,
        await readIdentityJson(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
