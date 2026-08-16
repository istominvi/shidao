import type { NextRequest } from "next/server";
import { createAiCourseBuilderService } from "@/modules/ai/course-builder-service";
import { createRouterAiClient } from "@/modules/ai/routerai";
import { runBoundedAiRequest } from "@/modules/ai/server-context";
import { sharedHistoryProvider } from "@/modules/ai/shared-history";
import type { SystemAssistantRequest } from "@/modules/ai/system-assistant-contracts";
import { createSystemAssistantService } from "@/modules/ai/system-assistant-service";
import { getActiveCourseBuilderContext } from "@/modules/course-builder/server-context";
import { createLessonRunsServiceForActor } from "@/modules/lesson-runs/server-context";
import { CommunicationApplicationError } from "./contracts";
import type { CommunicationActor } from "./domain";

export async function runCommunicationAssistantChat(
  request: NextRequest,
  communicationActor: CommunicationActor,
  input: SystemAssistantRequest,
  signal?: AbortSignal,
) {
  const { actor, service } = await getActiveCourseBuilderContext();
  if (actor.authUserId !== communicationActor.authUserId) {
    throw new CommunicationApplicationError(
      "Войдите снова, чтобы открыть диалог с ИИ.",
      401,
      "communication_reauthentication_required",
    );
  }
  const learningService = createLessonRunsServiceForActor(actor);
  const lessonPlanner = createAiCourseBuilderService({
    actor,
    service,
    learningHistoryService: learningService,
    sharedHistoryProvider,
    createProvider: createRouterAiClient,
  });
  const assistant = createSystemAssistantService({
    actor,
    courseService: service,
    learningService,
    sharedHistoryProvider,
    createProvider: createRouterAiClient,
    lessonPlanningService: {
      planLesson: (courseId, lessonInput, planningSignal) =>
        runBoundedAiRequest(
          request,
          {
            actorAuthUserId: actor.authUserId,
            scope: "lesson-plan",
            limit: 12,
            windowMs: 60 * 60 * 1_000,
          },
          () => lessonPlanner.planLesson(courseId, lessonInput, planningSignal),
        ),
      applyLessonPlan: (courseId, lessonInput) =>
        lessonPlanner.applyLessonPlan(courseId, lessonInput),
    },
  });

  return runBoundedAiRequest(
    request,
    {
      actorAuthUserId: actor.authUserId,
      scope: "assistant",
      limit: 30,
      windowMs: 10 * 60 * 1_000,
    },
    () => assistant.chat(input, signal),
  );
}
