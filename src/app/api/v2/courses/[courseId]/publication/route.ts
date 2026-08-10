import { NextResponse } from "next/server";
import {
  coursePublicationApiError,
  getCoursePublicationContext,
  readPublicationJson,
} from "@/modules/course-publications/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    return NextResponse.json({
      publication: await publicationService.getOwnedPublication(
        actor,
        courseId,
      ),
    });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    const publication = await publicationService.publishCourse(
      actor,
      courseId,
      await readPublicationJson(request),
      "create",
    );
    return NextResponse.json({ publication }, { status: 201 });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    return NextResponse.json({
      publication: await publicationService.publishCourse(
        actor,
        courseId,
        await readPublicationJson(request),
        "update",
      ),
    });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, publicationService } = await getCoursePublicationContext();
    return NextResponse.json({
      publication: await publicationService.unpublishCourse(actor, courseId),
    });
  } catch (error) {
    return coursePublicationApiError(error);
  }
}
