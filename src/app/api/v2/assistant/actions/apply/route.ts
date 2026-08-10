import { NextRequest, NextResponse } from "next/server";
import { CourseBuilderValidationError } from "@/modules/course-builder/contracts";
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
    const lockId =
      parsed.data.action.type === "course.add_lesson"
        ? parsed.data.action.courseId
        : CREATE_COURSE_LOCK_ID;
    const assistant = createSystemAssistantService({
      actor,
      courseService: service,
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
