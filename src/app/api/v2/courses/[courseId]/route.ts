import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    return NextResponse.json({
      course: await service.getCourse(actor, courseId),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const course = await service.updateCourse(
      actor,
      courseId,
      await readJson(request),
    );
    return NextResponse.json({ course });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
