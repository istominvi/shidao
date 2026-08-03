import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const result = await service.assembleCourse(actor, courseId);
    return NextResponse.json({ result });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
