import { NextResponse } from "next/server";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      runs: await service.listLessonHistory(actor, lessonId),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
