import { NextRequest, NextResponse } from "next/server";
import {
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import {
  getActiveCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";
import {
  aiApiError,
  runBoundedAiRequest,
  runExclusiveAiApply,
  runIdempotentAiAssistantAction,
} from "@/modules/ai/server-context";
import { systemAssistantApplyRequestSchema } from "@/modules/ai/system-assistant-contracts";
import { createSystemAssistantService } from "@/modules/ai/system-assistant-service";
import { createAiCourseBuilderService } from "@/modules/ai/course-builder-service";
import { sharedHistoryProvider } from "@/modules/ai/shared-history";
import { createLessonRunsServiceForActor } from "@/modules/lesson-runs/server-context";
import { verifySystemAssistantActionProposal } from "@/modules/ai/system-assistant-proposal-signature";

export const runtime = "nodejs";

const CREATE_COURSE_LOCK_ID = "00000000-0000-4000-8000-000000000001";

export async function POST(request: NextRequest) {
  try {
    const { actor, service } = await getActiveCourseBuilderContext();
    const parsed = systemAssistantApplyRequestSchema.safeParse(
      await readJson(request),
    );
    if (!parsed.success) {
      throw new CourseBuilderValidationError(
        parsed.error.issues[0]?.message ?? "Проверьте действие ассистента.",
      );
    }
    if (
      !verifySystemAssistantActionProposal(parsed.data.signature, {
        actorAuthUserId: actor.authUserId,
        proposal: {
          idempotencyKey: parsed.data.idempotencyKey,
          action: parsed.data.action,
        },
      })
    ) {
      throw new CourseBuilderConflictError(
        "Предложение ассистента устарело или было изменено. Подготовьте его заново.",
        "ai_action_proposal_invalid",
      );
    }
    const lockId =
      parsed.data.action.type === "course.create_draft"
        ? CREATE_COURSE_LOCK_ID
        : parsed.data.action.courseId;
    const learningService = createLessonRunsServiceForActor(actor);
    const lessonPlanner = createAiCourseBuilderService({
      actor,
      service,
      learningHistoryService: learningService,
      sharedHistoryProvider,
    });
    const assistant = createSystemAssistantService({
      actor,
      courseService: service,
      lessonPlanningService: lessonPlanner,
    });
    const result = await runIdempotentAiAssistantAction(
      actor.authUserId,
      parsed.data.idempotencyKey,
      () =>
        runBoundedAiRequest(
          request,
          {
            actorAuthUserId: actor.authUserId,
            scope: "assistant-action",
            limit: 20,
            windowMs: 10 * 60 * 1_000,
            maxInFlight: 2,
          },
          () =>
            runExclusiveAiApply(actor.authUserId, lockId, () =>
              assistant.applyAction(parsed.data.action),
            ),
        ),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return aiApiError(error);
  }
}
