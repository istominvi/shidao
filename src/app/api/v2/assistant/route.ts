import { NextRequest, NextResponse } from "next/server";
import { createRouterAiClient } from "@/modules/ai/routerai";
import { sharedHistoryProvider } from "@/modules/ai/shared-history";
import { aiApiError, runBoundedAiRequest } from "@/modules/ai/server-context";
import { createSystemAssistantService } from "@/modules/ai/system-assistant-service";
import {
  getActiveCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";
import { createLessonRunsServiceForActor } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { actor, service } = await getActiveCourseBuilderContext();
    const result = await runBoundedAiRequest(
      request,
      {
        actorAuthUserId: actor.authUserId,
        scope: "assistant",
        limit: 30,
        windowMs: 10 * 60 * 1_000,
      },
      async () =>
        createSystemAssistantService({
          actor,
          courseService: service,
          learningService: createLessonRunsServiceForActor(actor),
          sharedHistoryProvider,
          createProvider: createRouterAiClient,
        }).chat(await readJson(request), request.signal),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return aiApiError(error);
  }
}
