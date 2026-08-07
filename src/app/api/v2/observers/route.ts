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

export async function GET() {
  try {
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(await service.listObserverOverview(actor));
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const limited = identityMutationRateLimit(
    request,
    "observer-invitation-create",
    6,
  );
  if (limited) return limited;
  try {
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(
      await service.createObserverInvitation(
        actor,
        await readIdentityJson(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
