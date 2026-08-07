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
type Context = {
  params: Promise<{ mergeOperationId: string; action: string }>;
};

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(request, "learner-merge-action", 8);
  if (limited) return limited;
  try {
    const { mergeOperationId, action: rawAction } = await params;
    const action = assertAction(rawAction, [
      "preview",
      "confirm",
      "cancel",
    ] as const);
    const { actor, service } = await getLearnerIdentityContext();
    if (action === "preview") {
      return NextResponse.json(
        await service.previewMerge(actor, mergeOperationId),
      );
    }
    if (action === "cancel") {
      await service.cancelMerge(actor, mergeOperationId);
      return NextResponse.json({ cancelled: true });
    }
    const body = await readIdentityJson(request);
    return NextResponse.json(
      await service.confirmMerge(actor, {
        ...(body && typeof body === "object" ? body : {}),
        mergeOperationId,
      }),
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
