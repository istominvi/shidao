import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const course = await service.getStudentPreview(actor, courseId);
    return NextResponse.json({ course });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
