import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ lessonRunId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      run: await service.rescheduleRun(
        actor,
        lessonRunId,
        await readJson(request),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
