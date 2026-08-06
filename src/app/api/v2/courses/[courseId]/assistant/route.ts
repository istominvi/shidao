import { NextRequest, NextResponse } from "next/server";
import { createAiCourseBuilderService } from "@/modules/ai/course-builder-service";
import { createRouterAiClient } from "@/modules/ai/routerai";
import { aiApiError, runBoundedAiRequest } from "@/modules/ai/server-context";
import {
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

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
        scope: "assistant",
        limit: 30,
        windowMs: 10 * 60 * 1_000,
      },
      async () =>
        createAiCourseBuilderService({
          actor,
          service,
          createProvider: createRouterAiClient,
        }).chat(courseId, await readJson(request), request.signal),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return aiApiError(error);
  }
}
