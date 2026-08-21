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
    const learningActivities = createLearningActivitiesServiceForActor(actor);
    const learningRecordIds = records.map((record) => record.id);
    const [observationsResult, correctionsResult, evidenceResult] =
      await Promise.allSettled([
        learningActivities.listHistoryObservations(actor, learningRecordIds),
        learningActivities.listHistoryCorrections(actor, records),
        learningActivities.listHistoryEvidence(actor, learningRecordIds),
      ]);
    if (observationsResult.status === "rejected") {
      throw observationsResult.reason;
    }
    const correctionsUnavailable = correctionsResult.status === "rejected";
    const evidenceUnavailable = evidenceResult.status === "rejected";
    const evidence =
      evidenceResult.status === "fulfilled" ? evidenceResult.value : [];
    return NextResponse.json({
      records,
      observations: observationsResult.value,
      corrections:
        correctionsResult.status === "fulfilled"
          ? correctionsResult.value.items
          : [],
      correctionsTruncated:
        correctionsResult.status === "fulfilled"
          ? correctionsResult.value.truncated
          : false,
      correctionsUnavailable,
      evidence,
      evidenceUnavailable,
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
