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
    const body = await readJson(request);
    const { actor, service } = await getCourseBuilderContext();
    const component = await service.addComponent(actor, {
      ...(typeof body === "object" && body !== null ? body : {}),
      lessonId,
    });
    return NextResponse.json({ component }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
