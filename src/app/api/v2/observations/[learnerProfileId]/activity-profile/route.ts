import { NextResponse } from "next/server";
import {
  getLearningActivitiesContext,
  learningActivityProfileApiError,
} from "@/modules/learning-activities/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ learnerProfileId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLearningActivitiesContext();
    return NextResponse.json({
      profile: await service.getObservedActivityProfile(
        actor,
        learnerProfileId,
      ),
    });
  } catch (error) {
    return learningActivityProfileApiError(error);
  }
}
