import { NextResponse } from "next/server";
import {
  getLearningActivitiesContext,
  learningActivityProfileApiError,
} from "@/modules/learning-activities/server-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { actor, service } = await getLearningActivitiesContext();
    return NextResponse.json({
      profile: await service.getMyActivityProfile(actor),
    });
  } catch (error) {
    return learningActivityProfileApiError(error);
  }
}
