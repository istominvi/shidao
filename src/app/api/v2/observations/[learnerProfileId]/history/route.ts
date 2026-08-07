import { NextResponse } from "next/server";
import { cursorQuery } from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = { params: Promise<{ learnerProfileId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(
      await service.getObservedHistory(
        actor,
        learnerProfileId,
        cursorQuery(request),
      ),
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
