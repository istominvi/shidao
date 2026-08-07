import { NextRequest, NextResponse } from "next/server";
import {
  assertAction,
  identityMutationRateLimit,
  readIdentityJson,
} from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = { params: Promise<{ relationshipId: string; action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "observer-relationship-action",
    10,
  );
  if (limited) return limited;
  try {
    const { relationshipId, action: rawAction } = await params;
    const action = assertAction(rawAction, [
      "accept",
      "reject",
      "revoke",
      "leave",
      "rename",
    ] as const);
    const input = await readIdentityJson(request);
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(
      await service.actOnObserverRelationship(actor, relationshipId, {
        ...(input && typeof input === "object" ? input : {}),
        action,
      }),
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
