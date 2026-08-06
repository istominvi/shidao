import { NextResponse } from "next/server";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ learnerProfileId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { learnerProfileId } = await params;
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      records: await service.listLearnerHistory(actor, learnerProfileId),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
