import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ componentId: string }> },
) {
  try {
    const { componentId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const component = await service.reorderComponent(
      actor,
      componentId,
      await readJson(request),
    );
    return NextResponse.json({ component });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
