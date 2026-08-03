import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const step = await service.addStep(
      actor,
      lessonId,
      await readJson(request),
    );
    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
