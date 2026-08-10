import { NextResponse } from "next/server";
import {
  coursePublicationApiError,
  getCoursePublicationContext,
  readOptionalPublicationJson,
} from "@/modules/course-publications/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { publicationId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    const result = await publicationService.copyCatalogCourse(
      actor,
      publicationId,
      await readOptionalPublicationJson(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}
