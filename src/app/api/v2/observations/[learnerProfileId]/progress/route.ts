import { NextResponse } from "next/server";
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
      progress: await service.getObservedProgress(actor, learnerProfileId),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
