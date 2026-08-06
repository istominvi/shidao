import { NextResponse } from "next/server";
import { CourseBuilderValidationError } from "@/modules/course-builder/contracts";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      throw new CourseBuilderValidationError(
        "Укажите начало и конец периода расписания.",
      );
    }
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      runs: await service.listSchedule(actor, { from, to }),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
