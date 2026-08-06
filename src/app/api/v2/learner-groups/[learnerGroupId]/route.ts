import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ learnerGroupId: string }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { learnerGroupId } = await params;
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      learnerGroup: await service.updateLearnerGroup(
        actor,
        learnerGroupId,
        await readJson(request),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { learnerGroupId } = await params;
    const { actor, service } = await getLessonRunsContext();
    await service.deleteLearnerGroup(actor, learnerGroupId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
