import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const lesson = await service.updateLesson(
      actor,
      lessonId,
      await readJson(request),
    );
    return NextResponse.json({ lesson });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    return NextResponse.json(await service.deleteLesson(actor, lessonId));
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
