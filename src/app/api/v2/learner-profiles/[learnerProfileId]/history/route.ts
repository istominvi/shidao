import { NextResponse } from "next/server";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

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
    return NextResponse.json({
      records: await service.listLearnerHistory(
        actor,
        resolvedLearnerProfileId,
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
