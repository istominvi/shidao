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
    return NextResponse.json({
      requests: await service.listConnections(actor),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const limited = identityMutationRateLimit(
    request,
    "learner-connection-create",
    8,
  );
  if (limited) return limited;
  try {
    const { actor, service } = await getLearnerIdentityContext();
    const result = await service.createConnection(
      actor,
      await readIdentityJson(request),
    );
    // Email discovery deliberately returns the same status whether an Account
    // already existed or not.
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
