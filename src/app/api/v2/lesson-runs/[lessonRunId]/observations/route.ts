import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getLearningActivitiesContext } from "@/modules/learning-activities/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ lessonRunId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { actor, service } = await getLearningActivitiesContext();
    return NextResponse.json({
      workspace: await service.getRunWorkspace(actor, lessonRunId),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { actor, service } = await getLearningActivitiesContext();
    return NextResponse.json({
      observations: await service.saveRunObservations(
        actor,
        lessonRunId,
        await readJson(request),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
