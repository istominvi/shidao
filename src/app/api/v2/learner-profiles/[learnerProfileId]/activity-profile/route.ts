import { NextResponse } from "next/server";
import { getActiveCourseBuilderContext } from "@/modules/course-builder/server-context";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";
import {
  createLearningActivitiesServiceForActor,
  learningActivityProfileApiError,
} from "@/modules/learning-activities/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ learnerProfileId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { learnerProfileId } = await params;
  let resolvedLearnerProfileId: string;
  try {
    const identity = await getLearnerIdentityContext();
    resolvedLearnerProfileId =
      await identity.service.resolveTeacherLearnerAlias(
        identity.actor,
        learnerProfileId,
      );
  } catch (error) {
    return learnerIdentityApiError(error);
  }

  try {
    const { actor } = await getActiveCourseBuilderContext();
    return NextResponse.json({
      profile: await createLearningActivitiesServiceForActor(
        actor,
      ).getTeacherLearnerActivityProfile(actor, resolvedLearnerProfileId),
    });
  } catch (error) {
    return learningActivityProfileApiError(error);
  }
}
