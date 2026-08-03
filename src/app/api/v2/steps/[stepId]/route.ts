import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> },
) {
  try {
    const { stepId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const step = await service.updateStep(
      actor,
      stepId,
      await readJson(request),
    );
    return NextResponse.json({ step });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
