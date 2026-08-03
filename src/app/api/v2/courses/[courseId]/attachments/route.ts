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
    const attachment = await service.prepareAttachment(
      actor,
      courseId,
      await readJson(request),
    );
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
