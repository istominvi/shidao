import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ learnerProfileId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
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
      learnerProfile: await service.updateLearnerProfile(
        actor,
        resolvedLearnerProfileId,
        await readJson(request),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
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
    const learnerProfile = await service.archiveLearnerProfile(
      actor,
      resolvedLearnerProfileId,
    );
    return NextResponse.json({
      deleted: true,
      learnerProfile,
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
