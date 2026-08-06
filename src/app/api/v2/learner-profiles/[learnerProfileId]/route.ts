import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ learnerProfileId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      learnerProfile: await service.updateLearnerProfile(
        actor,
        learnerProfileId,
        await readJson(request),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLessonRunsContext();
    const learnerProfile = await service.archiveLearnerProfile(
      actor,
      learnerProfileId,
    );
    return NextResponse.json({
      deleted: true,
      learnerProfile,
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
