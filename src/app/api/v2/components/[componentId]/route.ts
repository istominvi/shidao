import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ componentId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { componentId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    const component = await service.updateComponent(
      actor,
      componentId,
      await readJson(request),
    );
    return NextResponse.json({ component });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { componentId } = await params;
    const { actor, service } = await getCourseBuilderContext();
    return NextResponse.json(await service.deleteComponent(actor, componentId));
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
