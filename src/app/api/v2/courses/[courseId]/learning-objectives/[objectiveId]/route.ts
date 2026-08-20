import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getActiveCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ courseId: string; objectiveId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { courseId, objectiveId } = await params;
    const { actor, service } = await getActiveCourseBuilderContext();
    const learningObjective = await service.updateLearningObjective(
      actor,
      courseId,
      objectiveId,
      await readJson(request),
    );
    return NextResponse.json({ learningObjective });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { courseId, objectiveId } = await params;
    const { actor, service } = await getActiveCourseBuilderContext();
    const learningObjective = await service.archiveLearningObjective(
      actor,
      courseId,
      objectiveId,
    );
    return NextResponse.json({ learningObjective });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
