import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getActiveCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getActiveCourseBuilderContext();
    const learningObjective = await service.createLearningObjective(
      actor,
      courseId,
      await readJson(request),
    );
    return NextResponse.json({ learningObjective }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
