import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; assetId: string }> },
) {
  try {
    const { courseId, assetId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const asset = await service.completeAttachment(actor, courseId, assetId);
    return NextResponse.json({ asset });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
