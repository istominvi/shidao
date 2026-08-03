import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
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
    const lesson = await service.addLesson(
      actor,
      courseId,
      await readJson(request),
    );
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
