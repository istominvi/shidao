import { NextResponse } from "next/server";
import {
  courseAttestationApiError,
  getCourseAttestationContext,
} from "@/modules/course-attestations/server-context";
import { CourseAttestationApplicationError } from "@/modules/course-attestations/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { service } = await getCourseAttestationContext();
    return NextResponse.json({
      attestation: await service.getAuthoredCourseAttestation(courseId),
    });
  } catch (error) {
    return courseAttestationApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { service } = await getCourseAttestationContext();
    const input = await request.json().catch(() => {
      throw new CourseAttestationApplicationError(
        "Ожидался JSON body.",
        "validation_error",
        400,
      );
    });
    return NextResponse.json({
      attestation: await service.replaceAuthoredCourseAttestation(
        courseId,
        input,
      ),
    });
  } catch (error) {
    return courseAttestationApiError(error);
  }
}
