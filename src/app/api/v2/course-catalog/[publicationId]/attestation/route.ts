import { NextResponse } from "next/server";
import {
  courseAttestationApiError,
  getCourseAttestationContext,
} from "@/modules/course-attestations/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicationId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { publicationId } = await params;
    const { service } = await getCourseAttestationContext();
    return NextResponse.json({
      attestation: await service.getPublicationAttestation(publicationId),
    });
  } catch (error) {
    return courseAttestationApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { publicationId } = await params;
    const { service } = await getCourseAttestationContext();
    const input = await request.json().catch(() => {
      throw new Error("invalid_json");
    });
    return NextResponse.json({
      attestation: await service.submitPublicationAttestation(
        publicationId,
        input,
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_json") {
      return NextResponse.json(
        { error: "Ожидался JSON body.", code: "validation_error" },
        { status: 400 },
      );
    }
    return courseAttestationApiError(error);
  }
}
