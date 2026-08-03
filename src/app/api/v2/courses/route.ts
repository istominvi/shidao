import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { actor, service } = await getCourseBuilderContext();
    return NextResponse.json({ courses: await service.listCourses(actor) });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, service } = await getCourseBuilderContext();
    const course = await service.createDraft(actor, await readJson(request));
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
