import { NextResponse } from "next/server";
import {
  coursePublicationApiError,
  getCoursePublicationContext,
} from "@/modules/course-publications/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicationId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { publicationId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    return NextResponse.json({
      course: await publicationService.getCatalogDetail(actor, publicationId),
    });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}
