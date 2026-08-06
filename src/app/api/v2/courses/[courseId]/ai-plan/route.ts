import { NextRequest, NextResponse } from "next/server";
import { aiApiError, runBoundedAiRequest } from "@/modules/ai/server-context";
import { createAiCourseBuilderService } from "@/modules/ai/course-builder-service";
import { createRouterAiClient } from "@/modules/ai/routerai";
import {
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";
import { createLessonRunsServiceForActor } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const result = await runBoundedAiRequest(
      request,
      {
        actorAuthUserId: actor.authUserId,
        scope: "course-plan",
        limit: 5,
        windowMs: 60 * 60 * 1_000,
        maxInFlight: 1,
      },
      async () =>
        createAiCourseBuilderService({
          actor,
          service,
          learningHistoryService: createLessonRunsServiceForActor(actor),
          createProvider: createRouterAiClient,
        }).planCourse(courseId, await readJson(request), request.signal),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return aiApiError(error);
  }
}
