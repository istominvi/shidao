import { NextResponse } from "next/server";
import { aiApiError, runExclusiveAiApply } from "@/modules/ai/server-context";
import { createAiCourseBuilderService } from "@/modules/ai/course-builder-service";
import {
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const input = await readJson(request);
    const result = await runExclusiveAiApply(actor.authUserId, courseId, () =>
      createAiCourseBuilderService({
        actor,
        service,
      }).applyCoursePlan(courseId, input),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return aiApiError(error);
  }
}
