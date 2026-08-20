import { NextResponse } from "next/server";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";
import { createLearningActivitiesServiceForActor } from "@/modules/learning-activities/server-context";

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
    const { actor, service } = await getLessonRunsContext();
    const records = await service.listLearnerHistory(
      actor,
      resolvedLearnerProfileId,
    );
    return NextResponse.json({
      records,
      observations: await createLearningActivitiesServiceForActor(
        actor,
      ).listHistoryObservations(
        actor,
        records.map((record) => record.id),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
