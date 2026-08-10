import { NextResponse } from "next/server";
import {
  coursePublicationApiError,
  getCoursePublicationContext,
  readOptionalPublicationJson,
} from "@/modules/course-publications/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    const result = await publicationService.duplicateOwnCourse(
      actor,
      courseId,
      await readOptionalPublicationJson(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}
