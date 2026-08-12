import { NextResponse } from "next/server";
import {
  courseAttestationApiError,
  getCourseAttestationContext,
} from "@/modules/course-attestations/server-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { service } = await getCourseAttestationContext();
    return NextResponse.json({
      attestations: await service.listAccountAttestations(),
    });
  } catch (error) {
    return courseAttestationApiError(error);
  }
}
