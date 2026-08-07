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
type Context = { params: Promise<{ connectionId: string; action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "learner-connection-action",
  );
  if (limited) return limited;
  try {
    const { connectionId, action: rawAction } = await params;
    const action = assertAction(rawAction, [
      "accept",
      "reject",
      "cancel",
    ] as const);
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({
      request: await service.actOnConnection(actor, connectionId, action),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
